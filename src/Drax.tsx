import React, {
	FunctionComponent,
	PropsWithChildren,
	ReactElement,
	createContext,
	useCallback,
	useContext,
	useEffect,
	useReducer,
	useRef,
	useState,
} from 'react';
import {
	ViewProps,
	View,
	Animated,
	ViewStyle,
	StyleProp,
} from 'react-native';
import { createAction, ActionType, getType } from 'typesafe-actions';
import {
	PanGestureHandler,
	PanGestureHandlerGestureEvent,
	PanGestureHandlerStateChangeEvent,
	State,
} from 'react-native-gesture-handler';
import uuid from 'uuid/v4';

const dragAnimationReleaseDelay = 100;

interface Measurements {
	x: number; // x position of view within its parent
	y: number; // y position of view within its parent
	width: number;
	height: number;
	pageX: number; // x position of view within screen
	pageY: number; // y position of view within screen
}

interface DraxProtocol {
	/** Called in the dragged view when a drag action begins */
	onDragStart?: () => void;

	/** Called in the dragged view repeatedly while dragged, not over any receiver */
	onDrag?: () => void;

	/** Called in the dragged view when dragged onto a new receiver */
	onDragEnter?: (receiverPayload: any) => void;

	/** Called in the dragged view repeatedly while dragged over a receiver */
	onDragOver?: (receiverPayload: any) => void;

	/** Called in the dragged view when dragged off of a receiver */
	onDragExit?: (receiverPayload: any) => void;

	/** Called in the dragged view when drag ends or is cancelled, not over any receiver */
	onDragEnd?: () => void;

	/** Called in the dragged view when drag ends over a receiver */
	onDragDrop?: (receiverPayload: any) => void;

	/** Called in the receiver view when an item is dragged onto it */
	onReceiveDragEnter?: (dragPayload: any) => void;

	/** Called in the receiver view repeatedly while an item is dragged over it */
	onReceiveDragOver?: (dragPayload: any) => void;

	/** Called in the receiver view when item is dragged off of it or drag is cancelled */
	onReceiveDragExit?: (dragPayload: any) => void;

	/** Called in the receiver view when drag ends over it */
	onReceiveDragDrop?: (dragPayload: any) => void;

	/** Convenience prop to provide the same value for dragPayload and receiverPayload */
	payload?: any;

	/** Payload that will be delivered to receivers when this view is dragged */
	dragPayload?: any;

	/** Payload that will be delievered to dragged views when this view receives them */
	receiverPayload?: any;

	/** Whether the view can be dragged */
	draggable: boolean;

	/** Whether the view can receive drags */
	receptive: boolean;
}

interface DraxProtocolProps extends Partial<DraxProtocol> {}

enum DraxViewDragState {
	Inactive,
	Dragging,
	Released,
}

enum DraxViewReceiverState {
	Inactive,
	Receiving,
}

interface DraxActivity {
	dragState: DraxViewDragState;
	dragOffset: Animated.ValueXY;
	draggingOverReceiverPayload?: any;
	receiverState: DraxViewReceiverState;
	receiverOffset: Animated.ValueXY;
	receivingDragPayload?: any;
}

const createInitialActivity = (): DraxActivity => ({
	dragState: DraxViewDragState.Inactive,
	dragOffset: new Animated.ValueXY({ x: 0, y: 0 }),
	draggingOverReceiverPayload: undefined,
	receiverState: DraxViewReceiverState.Inactive,
	receiverOffset: new Animated.ValueXY({ x: 0, y: 0 }),
	receivingDragPayload: undefined,
});

interface DraxStateViewData {
	protocol: DraxProtocol;
	activity: DraxActivity;
	measurements?: Measurements;
}

interface DraxState {
	viewIds: string[];
	viewDataById: {
		[id: string]: DraxStateViewData;
	};
}

const initialState: DraxState = {
	viewIds: [],
	viewDataById: {},
};

const selectViewById = (state: DraxState, id: string | undefined): DraxStateViewData | undefined => (
	(id && state.viewIds.includes(id)) ? state.viewDataById[id] : undefined
);

interface RegisterViewPayload {
	id: string;
}

interface UnregisterViewPayload {
	id: string;
}

interface UpdateViewProtocolPayload {
	id: string;
	protocol: DraxProtocolProps;
}

interface MeasureViewPayload {
	id: string;
	measurements: Measurements;
}

interface UpdateActivityPayload {
	id: string;
	activity: Partial<DraxActivity>;
}

interface UpdateActivitiesPayload {
	activities: UpdateActivityPayload[];
}

const actions = {
	registerView: createAction('registerView')<RegisterViewPayload>(),
	unregisterView: createAction('unregisterView')<UnregisterViewPayload>(),
	updateViewProtocol: createAction('updateViewProtocol')<UpdateViewProtocolPayload>(),
	measureView: createAction('measureView')<MeasureViewPayload>(),
	updateActivity: createAction('updateActivity')<UpdateActivityPayload>(),
	updateActivities: createAction('updateActivities')<UpdateActivitiesPayload>(),
};

type DraxAction = ActionType<typeof actions>;

const reducer = (state: DraxState, action: DraxAction): DraxState => {
	switch (action.type) {
		case getType(actions.registerView): {
			const { id } = action.payload;

			// Make sure not to duplicate registered view id.
			const viewIds = state.viewIds.indexOf(id) < 0 ? [...state.viewIds, id] : state.viewIds;

			// Make sure not to overwrite existing view data.
			const existingData = selectViewById(state, id);

			return {
				...state,
				viewIds,
				viewDataById: {
					...state.viewDataById,
					...(existingData
						? {}
						: {
							[id]: {
								protocol: {
									draggable: false,
									receptive: false,
								},
								activity: createInitialActivity(),
							},
						}
					),
				},
			};
		}
		case getType(actions.unregisterView): {
			const { id } = action.payload;
			const { [id]: removed, ...viewDataById } = state.viewDataById;
			return {
				...state,
				viewDataById,
				viewIds: state.viewIds.filter((thisId) => thisId !== id),
			};
		}
		case getType(actions.updateViewProtocol): {
			const { id, protocol: protocolProps } = action.payload;

			const existingData = selectViewById(state, id);
			if (!existingData) {
				return state;
			}

			// Determine required and coalesced values if not explicitly provided.
			const protocol: DraxProtocol = {
				...protocolProps,
				draggable: protocolProps.draggable ?? (!!protocolProps.dragPayload
					|| !!protocolProps.onDrag
					|| !!protocolProps.onDragEnd
					|| !!protocolProps.onDragEnter
					|| !!protocolProps.onDragExit
					|| !!protocolProps.onDragOver
					|| !!protocolProps.onDragStart
					|| !!protocolProps.onDragDrop),
				receptive: protocolProps.receptive ?? (!!protocolProps.receiverPayload
					|| !!protocolProps.onReceiveDragEnter
					|| !!protocolProps.onReceiveDragExit
					|| !!protocolProps.onReceiveDragOver
					|| !!protocolProps.onReceiveDragDrop),
				dragPayload: protocolProps.dragPayload ?? protocolProps.payload,
				receiverPayload: protocolProps.receiverPayload ?? protocolProps.payload,
			};

			return {
				...state,
				viewDataById: {
					...state.viewDataById,
					[id]: {
						...existingData,
						protocol,
					},
				},
			};
		}
		case getType(actions.measureView): {
			const { id, measurements } = action.payload;

			const existingData = selectViewById(state, id);
			if (!existingData) {
				return state;
			}

			return {
				...state,
				viewDataById: {
					...state.viewDataById,
					[id]: {
						...existingData,
						measurements,
					},
				},
			};
		}
		case getType(actions.updateActivity): {
			const { id, activity } = action.payload;
			const existingData = selectViewById(state, id);
			return {
				...state,
				viewDataById: {
					...state.viewDataById,
					...(existingData
						? {
							[id]: {
								...existingData,
								activity: {
									...existingData.activity,
									...activity,
								},
							},
						}
						: {}
					),
				},
			};
		}
		case getType(actions.updateActivities): {
			const { activities } = action.payload;
			const viewDataById = activities.reduce(
				(prevViewDataById, { id, activity }) => {
					const existingData = selectViewById(state, id);
					return {
						...prevViewDataById,
						...(existingData
							? {
								[id]: {
									...existingData,
									activity: {
										...existingData.activity,
										...activity,
									},
								},
							}
							: {}
						),
					};
				},
				state.viewDataById,
			);
			return {
				...state,
				viewDataById,
			};
		}
		default:
			return state;
	}
};

interface DraxContextValue {
	getViewDataById: (id: string) => DraxStateViewData | undefined;
	registerView: (payload: RegisterViewPayload) => void;
	unregisterView: (payload: UnregisterViewPayload) => void;
	updateViewProtocol: (payload: UpdateViewProtocolPayload) => void;
	measureView: (payload: MeasureViewPayload) => void;
	handleGestureStateChange: (id: string, event: PanGestureHandlerStateChangeEvent) => void;
	handleGestureEvent: (id: string, event: PanGestureHandlerGestureEvent) => void;
}

const DraxContext = createContext<DraxContextValue | undefined>(undefined);
DraxContext.displayName = 'Drax';

export interface DraxProviderProps {
	debug?: boolean;
}

interface DragTracking {
	/** Start position of the drag in screen coordinates */
	startPosition: {
		x: number;
		y: number;
	};
	/** Information about the dragged view */
	dragged: {
		/** View id of the dragged view */
		id: string;
		/** Animation offset of drag translation */
		dragOffset: Animated.ValueXY;
	};
	/** Information about the current drag receiver, if any */
	receiver?: {
		/** View id of the receiver view */
		id: string;
		/** Animation offset of the current drag position relative to the receiver view */
		receiverOffset: Animated.ValueXY;
	};
}

export const DraxProvider: FunctionComponent<DraxProviderProps> = ({ debug = false, children }) => {
	const [state, dispatch] = useReducer(reducer, initialState);
	const dragTrackingRef = useRef<DragTracking | undefined>(undefined);
	const getViewDataById = useCallback(
		(id: string | undefined) => (
			(id && state.viewIds.includes(id)) ? state.viewDataById[id] : undefined
		),
		[state.viewIds, state.viewDataById],
	);
	const updateActivity = useCallback(
		(payload: UpdateActivityPayload) => {
			if (debug) {
				console.log(`Dispatching updateActivity(${JSON.stringify(payload, null, 2)})`);
			}
			dispatch(actions.updateActivity(payload));
		},
		[dispatch, debug],
	);
	const updateActivities = useCallback(
		(payload: UpdateActivitiesPayload) => {
			if (debug) {
				console.log(`Dispatching updateActivities(${JSON.stringify(payload, null, 2)})`);
			}
			dispatch(actions.updateActivities(payload));
		},
		[dispatch, debug],
	);
	const resetReceiver = useCallback(
		() => {
			const dragTracking = dragTrackingRef.current;
			if (dragTracking) {
				const { receiver } = dragTracking;
				if (receiver) {
					if (debug) {
						console.log('Resetting receiver');
					}
					const { id, receiverOffset } = receiver;
					dragTracking.receiver = undefined;
					updateActivity({
						id,
						activity: {
							receiverState: DraxViewReceiverState.Inactive,
							receivingDragPayload: undefined,
						},
					});
					receiverOffset.setValue({ x: 0, y: 0 });
				} else if (debug) {
					console.log('No receiver to reset');
				}
			}
		},
		[updateActivity, debug],
	);
	const resetDrag = useCallback(
		() => {
			const dragTracking = dragTrackingRef.current;
			if (dragTracking) {
				resetReceiver();
				const { dragged: { id, dragOffset } } = dragTracking;
				if (debug) {
					console.log('Resetting dragged view');
				}
				dragTrackingRef.current = undefined;
				updateActivity({
					id,
					activity: {
						dragState: DraxViewDragState.Released,
						draggingOverReceiverPayload: undefined,
					},
				});
				Animated.timing(
					dragOffset,
					{
						toValue: { x: 0, y: 0 },
						duration: 200,
						delay: dragAnimationReleaseDelay,
					},
				).start(({ finished }) => {
					if (finished) {
						updateActivity({
							id,
							activity: { dragState: DraxViewDragState.Inactive },
						});
					}
				});
			} else if (debug) {
				console.log('No dragged view to reset');
			}
		},
		[resetReceiver, updateActivity, debug],
	);
	const registerView = useCallback(
		(payload: RegisterViewPayload) => {
			if (debug) {
				console.log(`Dispatching registerView(${JSON.stringify(payload, null, 2)})`);
			}
			dispatch(actions.registerView(payload));
		},
		[dispatch, debug],
	);
	const unregisterView = useCallback(
		(payload: UnregisterViewPayload) => {
			if (debug) {
				console.log(`Dispatching unregisterView(${JSON.stringify(payload, null, 2)})`);
			}
			dispatch(actions.unregisterView(payload));
			const { id } = payload;
			if (dragTrackingRef.current?.dragged.id === id) {
				resetDrag();
			} else if (dragTrackingRef.current?.receiver?.id === id) {
				resetReceiver();
			}
		},
		[
			dispatch,
			resetReceiver,
			resetDrag,
			debug,
		],
	);
	const updateViewProtocol = useCallback(
		(payload: UpdateViewProtocolPayload) => {
			if (debug) {
				console.log(`Dispatching updateViewProtocol(${JSON.stringify(payload, null, 2)})`);
			}
			dispatch(actions.updateViewProtocol(payload));
		},
		[dispatch, debug],
	);
	const measureView = useCallback(
		(payload: MeasureViewPayload) => {
			if (debug) {
				console.log(`Dispatching measureView(${JSON.stringify(payload, null, 2)})`);
			}
			dispatch(actions.measureView(payload));
		},
		[dispatch, debug],
	);
	const findReceiver = useCallback(
		(screenX: number, screenY: number, excludeId?: string) => {
			/*
			 * Starting from the last registered view and going backwards, find
			 * the first (latest) receptive view that contains the coordinates.
			 */
			for (let i = state.viewIds.length - 1; i >= 0; i -= 1) {
				const targetId = state.viewIds[i];
				if (targetId !== excludeId) { // Don't consider the excluded view.
					const target = getViewDataById(targetId);
					if (target?.protocol.receptive) { // Only consider receptive views.
						const { measurements: targetMeasurements } = target;
						if (targetMeasurements) { // Only consider views for which we have measure data.
							if (screenX >= targetMeasurements.pageX
								&& screenY >= targetMeasurements.pageY
								&& screenX <= targetMeasurements.pageX + targetMeasurements.width
								&& screenY <= targetMeasurements.pageY + targetMeasurements.height) {
								// Drag point is within this target.
								return {
									id: targetId,
									data: target,
								};
							}
						}
					}
				}
			}
			return undefined;
		},
		[state.viewIds, getViewDataById],
	);
	const handleGestureStateChange = useCallback(
		(id: string, { nativeEvent }: PanGestureHandlerStateChangeEvent) => {
			if (debug) {
				console.log(`handleGestureStateChange(${id}, ${JSON.stringify(nativeEvent, null, 2)})`);
			}

			/*
			 * Documentation on gesture handler state flow used in switches below:
			 * https://github.com/kmagiera/react-native-gesture-handler/blob/master/docs/state.md
			 */

			const dragTracking = dragTrackingRef.current;

			/*
			 * Case 1: We're already dragging a different view.
			 * Case 2: This is the view we're already dragging.
			 * Case 3: We're not already dragging a view.
			 */
			if (dragTracking) {
				const draggedId = dragTracking.dragged.id;
				if (draggedId !== id) {
					// Case 1: We're already dragging a different view.

					if (debug) {
						console.log(`Ignoring gesture state change because another view is being dragged: ${draggedId}`);
					}
				} else {
					// Case 2: This is the view we're already dragging.

					let endDrag = false;
					let doDrop = false;

					switch (nativeEvent.state) {
						case State.BEGAN:
							// This should never happen, but we'll do nothing.
							if (debug) {
								console.log(`Received unexpected BEGAN event for dragged view id ${id}`);
							}
							break;
						case State.ACTIVE:
							// This should also never happen, but we'll do nothing.
							if (debug) {
								console.log(`Received unexpected ACTIVE event for dragged view id ${id}`);
							}
							break;
						case State.CANCELLED:
							// The gesture handler system has cancelled, so end the drag without dropping.
							if (debug) {
								console.log(`Stop dragging view id ${id} (CANCELLED)`);
							}
							endDrag = true;
							break;
						case State.FAILED:
							// This should never happen, but let's end the drag without dropping.
							if (debug) {
								console.log(`Received unexpected FAILED event for dragged view id ${id}`);
							}
							endDrag = true;
							break;
						case State.END:
							// User has ended the gesture, so end the drag, dropping into receiver if applicable.
							if (debug) {
								console.log(`Stop dragging view id ${id} (END)`);
							}
							endDrag = true;
							doDrop = true;
							break;
						default:
							if (debug) {
								console.warn(`Unrecognized gesture state ${nativeEvent.state} for dragged view`);
							}
							break;
					}

					if (endDrag) {
						// Get data for dragged and receiver views (if any)
						const draggedData = getViewDataById(draggedId);
						const receiverData = getViewDataById(dragTracking.receiver?.id);

						// Reset drag
						resetDrag();

						if (doDrop && receiverData) {
							draggedData?.protocol.onDragDrop?.(receiverData.protocol.receiverPayload);
							receiverData.protocol.onReceiveDragDrop?.(draggedData?.protocol.dragPayload);
						} else {
							draggedData?.protocol.onDragEnd?.();
							receiverData?.protocol.onReceiveDragExit?.(draggedData?.protocol.dragPayload);
						}
					}
				}
			} else {
				// Case 3: We're not already dragging a view.

				const draggedData = getViewDataById(id);

				if (!draggedData) {
					if (debug) {
						console.log(`Ignoring gesture for view id ${id} because view data was not found`);
					}
				} else if (!draggedData.measurements) {
					if (debug) {
						console.log(`Ignoring gesture for view id ${id} because it is not yet measured`);
					}
				} else if (!draggedData.protocol.draggable) {
					if (debug) {
						console.log(`Ignoring gesture for undraggable view id ${id}`);
					}
				} else {
					let startDrag = false;

					switch (nativeEvent.state) {
						case State.ACTIVE:
							startDrag = true;
							break;
						case State.BEGAN:
							// Do nothing until the gesture becomes active.
							break;
						case State.CANCELLED:
						case State.FAILED:
						case State.END:
							// Do nothing because we weren't tracking this gesture.
							break;
						default:
							if (debug) {
								console.warn(`Unrecognized gesture state ${nativeEvent.state} for non-dragged view id ${id}`);
							}
							break;
					}

					if (startDrag) {
						const { pageX, pageY } = draggedData.measurements;
						const {
							x: grabX, // x position of touch relative to dragged view
							y: grabY, // y position of touch relative to dragged view
							translationX, // x difference of current touch from initial touch
							translationY, // y difference of current touch from initial touch
						} = nativeEvent;
						/*
						 * To determine drag start position in screen coordinates, we add:
						 *   screen coordinates of dragged view
						 *   + relative coordinates of touch within view
						 *
						 * (Note that we might already be slightly off of this position
						 * if the translation values are non-zero. That's ok because this
						 * represents the initial touch point.)
						 */
						const startPosition = {
							x: pageX + grabX,
							y: pageY + grabY,
						};
						const { dragOffset } = draggedData.activity;
						dragTrackingRef.current = {
							startPosition,
							dragged: { id, dragOffset },
							// No receiver yet
						};
						if (debug) {
							console.log(`Start dragging view id ${id} at screen position (${startPosition.x}, ${startPosition.y})`);
						}
						draggedData.protocol.onDragStart?.();
						updateActivity({
							id,
							activity: { dragState: DraxViewDragState.Dragging },
						});
						dragOffset.setValue({ x: translationX, y: translationY });
					}
				}
			}
		},
		[
			getViewDataById,
			resetDrag,
			updateActivity,
			debug,
		],
	);
	const handleGestureEvent = useCallback(
		(id: string, { nativeEvent }: PanGestureHandlerGestureEvent) => {
			if (debug) {
				console.log(`handleGestureEvent(${id}, ${JSON.stringify(nativeEvent, null, 2)})`);
			}

			const dragTracking = dragTrackingRef.current;
			if (!dragTracking) {
				// We're not tracking any gesture yet.
				if (debug) {
					console.log('Ignoring gesture event because we have not initialized a drag');
				}
				return;
			}

			const draggedId = dragTracking.dragged.id;
			if (draggedId !== id) {
				// This is not a gesture we're tracking. We don't support multiple simultaneous drags.
				if (debug) {
					console.log('Ignoring gesture event because this is not the view being dragged');
				}
				return;
			}

			const draggedData = getViewDataById(draggedId);
			if (!draggedData) {
				// The drag we're tracking is for a view that's no longer registered. Reset.
				resetDrag();
				return;
			}

			// We cannot be in a dragging state without measurements. (See handleGestureStateChange above.)
			const draggedMeasurements = draggedData.measurements!;

			/*
			 * To determine drag position in screen coordinates, we add:
			 *   screen coordinates of drag start
			 *   + translation offset of drag
			 */
			const { x: startX, y: startY } = dragTracking.startPosition;
			const { translationX, translationY } = nativeEvent;
			const dragScreenX = startX + translationX;
			const dragScreenY = startY + translationY;

			if (debug) {
				console.log(`Dragged item screen coordinates (${draggedMeasurements.pageX}, ${draggedMeasurements.pageY})`);
				console.log(`Native event translation (${translationX}, ${translationY})`);
				console.log(`Native event in-view touch coordinates: (${nativeEvent.x}, ${nativeEvent.y})`);
				console.log(`Calculated drag at screen coordinates (${dragScreenX}, ${dragScreenY})\n`);
			}

			const receiver = findReceiver(dragScreenX, dragScreenY, draggedId);
			const oldReceiverId = dragTracking.receiver?.id;

			// Always update the drag animation offset.
			draggedData.activity.dragOffset.setValue({ x: translationX, y: translationY });

			/*
			 * Consider the following cases for new and old receiver ids:
			 * Case 1: new exists, old exists, new is the same as old
			 * Case 2: new exists, old exists, new is different from old
			 * Case 3: new exists, old does not exist
			 * Case 4: new does not exist, old exists
			 * Case 5: new does not exist, old does not exist
			 */

			const draggedProtocol = draggedData.protocol;
			const activities: UpdateActivityPayload[] = [];

			if (receiver) {
				const { id: receiverId, data: receiverData } = receiver;
				const receiverProtocol = receiverData.protocol;

				// We cannot find a receiver without measurements. (See findReceiver.)
				const {
					pageX: receiverScreenX,
					pageY: receiverScreenY,
				} = receiverData.measurements!;

				// Update the current receiver animation offset.
				receiverData.activity.receiverOffset.setValue({
					x: dragScreenX - receiverScreenX,
					y: dragScreenY - receiverScreenY,
				});

				// Prepare dragged activity update, if necessary.
				if (draggedData.activity.draggingOverReceiverPayload !== receiverProtocol.receiverPayload) {
					activities.push({
						id: draggedId,
						activity: { draggingOverReceiverPayload: receiverProtocol.receiverPayload },
					});
				}

				if (oldReceiverId) {
					if (receiverId === oldReceiverId) {
						// Case 1: new exists, old exists, new is the same as old

						// Call the protocol event callbacks for dragging over the receiver.
						draggedProtocol.onDragOver?.(receiverProtocol.receiverPayload);
						receiverProtocol.onReceiveDragOver?.(draggedProtocol.dragPayload);

						// Prepare receiver activity update, if necessary.
						if (receiverData.activity.receivingDragPayload !== draggedProtocol.dragPayload) {
							activities.push({
								id: receiverId,
								activity: { receivingDragPayload: draggedProtocol.dragPayload },
							});
						}
					} else {
						// Case 2: new exists, old exists, new is different from old

						// Reset the old receiver and set the new one.
						resetReceiver();
						dragTracking.receiver = {
							id: receiverId,
							receiverOffset: receiverData.activity.receiverOffset,
						};

						// Call the protocol event callbacks for exiting the old receiver...
						const oldReceiverProtocol = getViewDataById(oldReceiverId)?.protocol;
						draggedProtocol.onDragExit?.(oldReceiverProtocol?.receiverPayload);
						oldReceiverProtocol?.onReceiveDragExit?.(draggedProtocol.dragPayload);

						// ...and entering the new receiver.
						draggedProtocol.onDragEnter?.(receiverProtocol?.receiverPayload);
						receiverProtocol.onReceiveDragEnter?.(draggedProtocol.dragPayload);

						// Prepare receiver activity update for old receiver...
						activities.push({
							id: oldReceiverId,
							activity: {
								receiverState: DraxViewReceiverState.Inactive,
								receivingDragPayload: undefined,
							},
						});

						// ...and for new receiver.
						activities.push({
							id: receiverId,
							activity: {
								receiverState: DraxViewReceiverState.Receiving,
								receivingDragPayload: draggedProtocol.dragPayload,
							},
						});
					}
				} else {
					// Case 3: new exists, old does not exist

					// Set the new receiver
					dragTracking.receiver = {
						id: receiverId,
						receiverOffset: receiverData.activity.receiverOffset,
					};

					// Call the protocol event callbacks for entering the new receiver.
					draggedProtocol.onDragEnter?.(receiverProtocol?.receiverPayload);
					receiverProtocol.onReceiveDragEnter?.(draggedProtocol.dragPayload);

					// Prepare receiver activity update for new receiver.
					activities.push({
						id: receiverId,
						activity: {
							receiverState: DraxViewReceiverState.Receiving,
							receivingDragPayload: draggedProtocol.dragPayload,
						},
					});
				}
			} else if (oldReceiverId) {
				// Case 4: new does not exist, old exists

				// Reset the old receiver. (Includes activity update.)
				resetReceiver();

				// Call the protocol event callbacks for exiting the old receiver.
				const oldReceiverProtocol = getViewDataById(oldReceiverId)?.protocol;
				draggedProtocol.onDragExit?.(oldReceiverProtocol?.receiverPayload);
				oldReceiverProtocol?.onReceiveDragExit?.(draggedProtocol.dragPayload);
			} else {
				// Case 5: new does not exist, old does not exist

				// Call the protocol event callback for dragging.
				draggedProtocol.onDrag?.();
			}

			// If there are any updates queued, dispatch them now.
			if (activities.length > 0) {
				updateActivities({ activities });
			}
		},
		[
			getViewDataById,
			updateActivities,
			findReceiver,
			resetDrag,
			resetReceiver,
			debug,
		],
	);
	useEffect(() => {
		if (debug) {
			console.log(`Rendering drax state: ${JSON.stringify(state, null, 2)}`);
		}
	});
	const value: DraxContextValue = {
		getViewDataById,
		registerView,
		unregisterView,
		updateViewProtocol,
		measureView,
		handleGestureStateChange,
		handleGestureEvent,
	};
	return (
		<DraxContext.Provider value={value}>
			{children}
		</DraxContext.Provider>
	);
};

export const useDrax = () => {
	const drax = useContext(DraxContext);
	if (!drax) {
		throw Error('No DraxProvider found');
	}
	return drax;
};

export interface DraxViewProps extends DraxProtocolProps, ViewProps {}

interface AnimatedViewRef { // workaround for lack of Animated.View type
	getNode: () => View;
}

export const DraxView = (
	{
		onDragStart,
		onDrag,
		onDragEnter,
		onDragOver,
		onDragExit,
		onDragEnd,
		onDragDrop,
		onReceiveDragEnter,
		onReceiveDragOver,
		onReceiveDragExit,
		onReceiveDragDrop,
		payload,
		dragPayload,
		receiverPayload,
		draggable,
		receptive,
		children,
		style: styleProp,
		...props
	}: PropsWithChildren<DraxViewProps>,
): ReactElement | null => {
	const [id, setId] = useState('');
	const ref = useRef<AnimatedViewRef>(null);
	const {
		getViewDataById,
		registerView,
		unregisterView,
		updateViewProtocol,
		measureView,
		handleGestureEvent,
		handleGestureStateChange,
	} = useDrax();
	useEffect(() => { setId(uuid()); }, []); // initialize id once
	useEffect(
		() => {
			if (id) {
				registerView({ id });
				return () => unregisterView({ id });
			}
			return undefined;
		},
		[id, registerView, unregisterView],
	);
	useEffect(
		() => {
			if (id) {
				updateViewProtocol({
					id,
					protocol: {
						onDragStart,
						onDrag,
						onDragEnter,
						onDragOver,
						onDragExit,
						onDragEnd,
						onDragDrop,
						onReceiveDragEnter,
						onReceiveDragOver,
						onReceiveDragExit,
						onReceiveDragDrop,
						payload,
						dragPayload,
						receiverPayload,
						draggable,
						receptive,
					},
				});
			}
		},
		[
			id,
			updateViewProtocol,
			onDragStart,
			onDrag,
			onDragEnter,
			onDragOver,
			onDragExit,
			onDragEnd,
			onDragDrop,
			onReceiveDragEnter,
			onReceiveDragOver,
			onReceiveDragExit,
			onReceiveDragDrop,
			payload,
			dragPayload,
			receiverPayload,
			draggable,
			receptive,
		],
	);
	const onHandlerStateChange = useCallback(
		(event: PanGestureHandlerStateChangeEvent) => handleGestureStateChange(id, event),
		[id, handleGestureStateChange],
	);
	const onGestureEvent = useCallback(
		(event: PanGestureHandlerGestureEvent) => handleGestureEvent(id, event),
		[id, handleGestureEvent],
	);
	const onLayout = useCallback(
		() => {
			if (ref.current) {
				ref.current.getNode().measure((x, y, width, height, pageX, pageY) => measureView({
					id,
					measurements: {
						x,
						y,
						width,
						height,
						pageX,
						pageY,
					},
				}));
			}
		},
		[id, measureView],
	);
	const activity = getViewDataById(id)?.activity;
	const style: any[] = [styleProp];
	if (activity) {
		if (activity.dragState === DraxViewDragState.Dragging) {
			style.push({
				borderColor: 'red',
				borderWidth: 3,
				opacity: 0.9,
				zIndex: 90, // Bring it up high, but only helps if views are siblings.
				transform: activity.dragOffset.getTranslateTransform(),
			});
		} else if (activity.dragState === DraxViewDragState.Released) {
			style.push({
				borderColor: 'grey',
				borderWidth: 3,
				opacity: 0.9,
				zIndex: 90, // Bring it up high, but only helps if views are siblings.
				transform: activity.dragOffset.getTranslateTransform(),
			});
		} else if (activity.receiverState === DraxViewReceiverState.Receiving) {
			style.push({
				borderColor: 'magenta',
				borderWidth: 3,
			});
		}
	}
	return (
		<PanGestureHandler
			onHandlerStateChange={onHandlerStateChange}
			onGestureEvent={onGestureEvent}
		>
			<Animated.View
				{...props}
				ref={ref}
				style={style}
				onLayout={onLayout}
			>
				{children}
			</Animated.View>
		</PanGestureHandler>
	);
};

// export interface DraxListProps<T> extends FlatListProps<T> {}

// export const DraxList = <T extends unknown>({ ...props }: DraxListProps<T>) => {
// 	const [id, setId] = useState('');
// 	const ref = useRef<FlatList<T>>(null);
// 	const {
// 		registerView,
// 		unregisterView,
// 		updateViewLayout,
// 	} = useDrax();
// 	useEffect(
// 		() => {
// 			const newId = uuid();
// 			setId(newId);
// 			console.log(`registering view id ${newId}`);
// 			registerView({ id: newId });
// 			return () => {
// 				console.log(`unregistering view id ${newId}`);
// 				unregisterView({ id: newId });
// 			};
// 		},
// 		[],
// 	);
// 	const onLayout = useCallback(
// 		(event: LayoutChangeEvent) => {
// 			const { layout } = event.nativeEvent;
// 			updateViewLayout({ id, layout });
// 			// if (ref.current) {
// 			// 	console.log(`Measuring ${id}`);
// 			// 	ref.current._component.measure((x, y, w, h, px, py) => {
// 			// 		console.log(`Measured ${id}: ${JSON.stringify({
// 			// 			x,
// 			// 			y,
// 			// 			w,
// 			// 			h,
// 			// 			px,
// 			// 			py,
// 			// 		}, null, 2)}`);
// 			// 	});
// 			// }
// 		},
// 		[id, ref],
// 	);
// 	const onScroll = useCallback(
// 		(event: NativeSyntheticEvent<NativeScrollEvent>) => {
// 			const {
// 				contentInset,
// 				contentOffset,
// 				contentSize,
// 				layoutMeasurement,
// 				velocity,
// 				zoomScale,
// 			} = event.nativeEvent;
// 			console.log(`onScroll: ${JSON.stringify({
// 				contentInset,
// 				contentOffset,
// 				contentSize,
// 				layoutMeasurement,
// 				velocity,
// 				zoomScale,
// 			}, null, 2)}`);
// 		},
// 		[],
// 	);
// 	if (!id) {
// 		return null;
// 	}
// 	return (
// 		<FlatList
// 			{...props}
// 			ref={ref}
// 			onLayout={onLayout}
// 			onScroll={onScroll}
// 		/>
// 	);
// };
