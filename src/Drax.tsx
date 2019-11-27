import React, {
	FunctionComponent,
	PropsWithChildren,
	createContext,
	useReducer,
	useCallback,
	useContext,
	useEffect,
	useState,
	useRef,
	ReactElement,
} from 'react';
import {
	ViewProps,
	View,
	Animated,
} from 'react-native';
import { createAction, ActionType, getType } from 'typesafe-actions';
import {
	PanGestureHandler,
	PanGestureHandlerGestureEvent,
	PanGestureHandlerStateChangeEvent,
	State,
} from 'react-native-gesture-handler';
import uuid from 'uuid/v4';

interface Measurements {
	x: number; // x position of view within its parent
	y: number; // y position of view within its parent
	width: number;
	height: number;
	pageX: number; // x position of view within screen
	pageY: number; // y position of view within screen
}

interface DraxProtocol {
	onDragStart?: () => void;
	onDrag?: () => void;
	onDragEnter?: (payload: any) => void;
	onDragOver?: (payload: any) => void;
	onDragExit?: (payload: any) => void;
	onDragEnd?: () => void;
	onDragDrop?: (payload: any) => void;

	onReceiveDragEnter?: (payload: any) => void;
	onReceiveDragOver?: (payload: any) => void;
	onReceiveDragExit?: (payload: any) => void;
	onReceiveDragDrop?: (payload: any) => void;

	dragPayload?: any;
	receiverPayload?: any;

	draggable: boolean;
	receptive: boolean;
}

interface DraxProtocolProps extends Partial<DraxProtocol> {}

enum DraxViewDragState {
	Inactive,
	Dragging,
	Released,
}

enum DraxViewReceivingState {
	Inactive,
	Receiving,
}

interface DraxActivity {
	dragState: DraxViewDragState;
	dragOffset: Animated.ValueXY;
	draggingOverReceiverPayload?: any;
	receivingState: DraxViewReceivingState;
	receivingOffset: Animated.ValueXY;
	receivingDragPayload?: any;
}

const createInitialActivity = (): DraxActivity => ({
	dragState: DraxViewDragState.Inactive,
	dragOffset: new Animated.ValueXY({ x: 0, y: 0 }),
	draggingOverReceiverPayload: undefined,
	receivingState: DraxViewReceivingState.Inactive,
	receivingOffset: new Animated.ValueXY({ x: 0, y: 0 }),
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

const getViewById = (state: DraxState, id: string | undefined): DraxStateViewData | undefined => (
	(id && state.viewIds.includes(id)) ? state.viewDataById[id] : undefined
);

interface RegisterViewPayload {
	id: string;
	protocol: DraxProtocolProps;
}

interface UnregisterViewPayload {
	id: string;
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
	measureView: createAction('measureView')<MeasureViewPayload>(),
	updateActivity: createAction('updateActivity')<UpdateActivityPayload>(),
	updateActivities: createAction('updateActivities')<UpdateActivitiesPayload>(),
};

type DraxAction = ActionType<typeof actions>;

const reducer = (state: DraxState, action: DraxAction): DraxState => {
	switch (action.type) {
		case getType(actions.registerView): {
			const { id, protocol: protocolProps } = action.payload;

			// Determine values for draggable/receptive if not explicitly provided.
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
			};

			/*
			 * If view has already been registered, update the protocol slice without
			 * affecting activity and measurements; otherwise, initialize fresh view data.
			 */
			const existingData = getViewById(state, id);
			const newViewData: DraxStateViewData = (existingData
				? { ...existingData, protocol }
				: { protocol, activity: createInitialActivity() }
			);

			// Make sure not to duplicate registered view id.
			const viewIds = state.viewIds.indexOf(id) < 0 ? [...state.viewIds, id] : state.viewIds;

			return {
				...state,
				viewIds,
				viewDataById: {
					...state.viewDataById,
					[id]: newViewData,
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
		case getType(actions.measureView): {
			const { id, measurements } = action.payload;
			const existingData = getViewById(state, id);
			return {
				...state,
				viewDataById: {
					...state.viewDataById,
					...(existingData
						? {
							[id]: {
								...existingData,
								measurements,
							},
						}
						: {}
					),
				},
			};
		}
		case getType(actions.updateActivity): {
			const { id, activity } = action.payload;
			const existingData = getViewById(state, id);
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
					const existingData = getViewById(state, id);
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
	state: DraxState;
	registerView: (payload: RegisterViewPayload) => void;
	unregisterView: (payload: UnregisterViewPayload) => void;
	measureView: (payload: MeasureViewPayload) => void;
	handleGestureStateChange: (id: string, event: PanGestureHandlerStateChangeEvent) => void;
	handleGestureEvent: (id: string, event: PanGestureHandlerGestureEvent) => void;
}

const DraxContext = createContext<DraxContextValue | undefined>(undefined);
DraxContext.displayName = 'Drax';

export interface DraxProviderProps {
	debug?: boolean;
}

export const DraxProvider: FunctionComponent<DraxProviderProps> = ({ debug = false, children }) => {
	const [state, dispatch] = useReducer(reducer, initialState);
	const draggedIdRef = useRef<string | undefined>(undefined);
	const receiverIdRef = useRef<string | undefined>(undefined);
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
	const findReceiver = useCallback(
		(screenX: number, screenY: number, excludeId?: string) => {
			/*
			 * Starting from the last registered view and going backwards, find
			 * the first (latest) receptive view that contains the coordinates.
			 */
			for (let i = state.viewIds.length - 1; i >= 0; i -= 1) {
				const targetId = state.viewIds[i];
				if (targetId !== excludeId) { // Don't consider the excluded view.
					const target = getViewById(state, targetId);
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
		[state],
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

			const draggedId = draggedIdRef.current;

			/*
			 * Case 1: We're already dragging a different view.
			 * Case 2: This is the view we're already dragging.
			 * Case 3: We're not already dragging a view.
			 */
			if (draggedId) {
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
						const draggedData = getViewById(state, draggedId);
						const receiverData = getViewById(state, receiverIdRef.current);

						// Clear existing dragged and receiver views
						draggedIdRef.current = undefined;
						receiverIdRef.current = undefined;

						if (!draggedData) {
							if (debug) {
								console.warn(`Failed to process end of drag for view id ${id} because view data was not found`);
							}
						} else {
							if (doDrop && receiverData) {
								draggedData.protocol.onDragDrop?.(receiverData.protocol.receiverPayload);
								receiverData.protocol.onReceiveDragDrop?.(draggedData.protocol.dragPayload);
							} else {
								draggedData.protocol.onDragEnd?.();
								receiverData?.protocol.onReceiveDragExit?.(draggedData.protocol.dragPayload);
							}
							updateActivity({
								id,
								activity: {
									dragState: DraxViewDragState.Released,
									draggingOverReceiverPayload: undefined,
								},
							});
							Animated.timing(
								draggedData.activity.dragOffset,
								{
									toValue: { x: 0, y: 0 },
								},
							).start(({ finished }) => {
								if (finished) {
									updateActivity({
										id,
										activity: {
											dragState: DraxViewDragState.Inactive,
										},
									});
								}
							});
						}
					}
				}
			} else {
				// Case 3: We're not already dragging a view.
				const draggedData = getViewById(state, id);
				let startDrag = false;

				switch (nativeEvent.state) {
					case State.ACTIVE:
						if (debug) {
							console.log(`Start dragging view id ${id}`);
						}
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
							console.warn(`Unrecognized gesture state ${nativeEvent.state} for non-dragged view`);
						}
						break;
				}

				if (startDrag) {
					if (!draggedData) {
						if (debug) {
							console.warn(`Failed to start drag for view id ${id} because view data was not found`);
						}
					} else {
						draggedIdRef.current = id;
						draggedData.protocol.onDragStart?.();
						updateActivity({
							id,
							activity: { dragState: DraxViewDragState.Dragging },
						});
						Animated.timing(
							draggedData.activity.dragOffset,
							{
								toValue: {
									x: nativeEvent.translationX,
									y: nativeEvent.translationY,
								},
							},
						).start();
					}
				}
			}
		},
		[updateActivity, draggedIdRef, debug],
	);
	const handleGestureEvent = useCallback(
		(id: string, { nativeEvent }: PanGestureHandlerGestureEvent) => {
			if (debug) {
				console.log(`handleGestureEvent(${id}, ${JSON.stringify(nativeEvent, null, 2)})`);
			}

			const draggedId = draggedIdRef.current;
			if (!draggedId || draggedId !== id) {
				// This is not the view being dragged. We don't support multiple simultaneous drags.
				if (debug) {
					console.log('Ignoring gesture event because this is not the view being dragged');
				}
				return;
			}

			const draggedData = getViewById(state, draggedId);
			const draggedMeasurements = draggedData?.measurements;
			if (!draggedMeasurements) {
				if (debug) {
					console.log(`Received drag event for unmeasured viewId ${draggedId}`);
				}
				return;
			}

			// Determine the x and y coordinates of the drag relative to the screen.
			const dragX = draggedMeasurements.pageX + nativeEvent.translationX + nativeEvent.x;
			const dragY = draggedMeasurements.pageY + nativeEvent.translationY + nativeEvent.y;

			const newReceiver = findReceiver(dragX, dragY, draggedId);
			const oldReceiverId = receiverIdRef.current;

			/*
			 * Consider the following cases for new and old receiver ids:
			 * Case 1: new exists, old exists, new is the same as old
			 * Case 2: new exists, old exists, new is different from old
			 * Case 3: new exists, old does not exist
			 * Case 4: new does not exist, old exists
			 * Case 5: new does not exist, old does not exist
			 */

			const draggedProtocol = draggedData?.protocol;

			if (newReceiver) {
				receiverIdRef.current = newReceiver.id;
				const newProtocol = newReceiver.data.protocol;
				if (oldReceiverId) {
					if (newReceiver.id === oldReceiverId) {
						// Case 1: new exists, old exists, new is the same as old
						newProtocol?.onReceiveDragOver?.(draggedProtocol?.dragPayload);

						// update receiving offset
						// update dragging offset

						// update receiving drag payload
						// update dragging receiver payload
					} else {
						// Case 2: new exists, old exists, new is different from old
						const oldProtocol = getViewById(state, oldReceiverId)?.protocol;
						oldProtocol?.onReceiveDragExit?.(draggedProtocol?.dragPayload);
					}
				} else {
					// Case 3: new exists, old does not exist
				}
			} else if (oldReceiverId) {
				// Case 4: new does not exist, old exists
			} else {
				// Case 5: new does not exist, old does not exist
			}
		},
		[updateActivities, debug],
	);
	useEffect(() => {
		if (debug) {
			console.log(`Rendering drax state: ${JSON.stringify(state, null, 2)}`);
		}
	});
	const value: DraxContextValue = {
		state,
		registerView,
		unregisterView,
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
		dragPayload,
		receiverPayload,
		children,
		...props
	}: PropsWithChildren<DraxViewProps>,
): ReactElement | null => {
	const [id, setId] = useState('');
	const ref = useRef<AnimatedViewRef>(null);
	const {
		registerView,
		unregisterView,
		measureView,
		handleGestureEvent,
		handleGestureStateChange,
	} = useDrax();
	useEffect(() => { setId(uuid()); }, []); // initialize id once
	useEffect(
		() => {
			if (!id) {
				return undefined;
			}
			registerView({
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
					dragPayload,
					receiverPayload,
				},
			});
			return () => unregisterView({ id });
		},
		[
			id,
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
			dragPayload,
			receiverPayload,
		],
	);
	const onHandlerStateChange = useCallback(
		(event: PanGestureHandlerStateChangeEvent) => handleGestureStateChange(id, event),
		[id],
	);
	const onGestureEvent = useCallback(
		(event: PanGestureHandlerGestureEvent) => handleGestureEvent(id, event),
		[id],
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
		[id, ref],
	);
	return (
		<PanGestureHandler
			onHandlerStateChange={onHandlerStateChange}
			onGestureEvent={onGestureEvent}
		>
			<Animated.View
				{...props}
				ref={ref}
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
