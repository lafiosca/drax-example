import React, {
	FunctionComponent,
	useReducer,
	useRef,
	useCallback,
	useEffect,
} from 'react';
import { Animated } from 'react-native';
import {
	State,
	LongPressGestureHandlerStateChangeEvent,
	LongPressGestureHandlerGestureEvent,
} from 'react-native-gesture-handler';

import { reducer, initialState } from './reducer';
import { actions } from './actions';
import {
	DraxProviderProps,
	DraxTracking,
	UpdateActivityPayload,
	UpdateActivitiesPayload,
	RegisterViewPayload,
	UnregisterViewPayload,
	UpdateViewProtocolPayload,
	MeasureViewPayload,
	DraxReceiverViewState,
	DraxDraggedViewState,
	DraxContextValue,
	DraxTrackingStatus,
} from '../types';
import {
	defaultDragReleaseAnimationDelay,
	defaultDragReleaseAnimationDuration,
} from '../params';
import { DraxContext } from '../DraxContext';

export const DraxProvider: FunctionComponent<DraxProviderProps> = ({ debug = false, children }) => {
	const [state, dispatch] = useReducer(reducer, initialState);
	const dragTrackingRef = useRef<DraxTracking | undefined>(undefined);
	const getViewData = useCallback(
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
							receiverState: DraxReceiverViewState.Inactive,
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
				const {
					dragged: {
						id,
						dragOffset,
						dragReleaseAnimationDelay,
						dragReleaseAnimationDuration,
					},
				} = dragTracking;
				if (debug) {
					console.log('Resetting dragged view');
				}
				dragTrackingRef.current = undefined;
				updateActivity({
					id,
					activity: {
						dragState: DraxDraggedViewState.Released,
						draggingOverReceiverPayload: undefined,
					},
				});
				Animated.timing(
					dragOffset,
					{
						toValue: { x: 0, y: 0 },
						delay: dragReleaseAnimationDelay,
						duration: dragReleaseAnimationDuration,
					},
				).start(({ finished }) => {
					if (finished) {
						updateActivity({
							id,
							activity: { dragState: DraxDraggedViewState.Inactive },
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
		(touchScreenX: number, touchScreenY: number, excludeViewId?: string) => {
			/*
			 * Starting from the last registered view and going backwards, find
			 * the first (latest) receptive view that contains the touch coordinates.
			 */
			for (let i = state.viewIds.length - 1; i >= 0; i -= 1) {
				const targetId = state.viewIds[i];
				if (targetId !== excludeViewId) { // Don't consider the excluded view.
					const target = getViewData(targetId);
					if (target?.protocol.receptive) { // Only consider receptive views.
						const { measurements: targetMeasurements } = target;
						if (targetMeasurements) { // Only consider views for which we have measure data.
							const {
								screenX,
								screenY,
								width,
								height,
							} = targetMeasurements;
							if (touchScreenX >= screenX
								&& touchScreenY >= screenY
								&& touchScreenX <= screenX + width
								&& touchScreenY <= screenY + height) {
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
		[state.viewIds, getViewData],
	);
	const handleGestureStateChange = useCallback(
		(id: string, { nativeEvent }: LongPressGestureHandlerStateChangeEvent) => {
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
						const draggedData = getViewData(draggedId);
						const receiverData = getViewData(dragTracking.receiver?.id);

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

				const draggedData = getViewData(id);

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
						const {
							screenX, // x position of dragged view within screen
							screenY, // y position of dragged view within screen
							width, // width of dragged view
							height, // height of dragged view
						} = draggedData.measurements;
						const {
							x: grabX, // x position of touch relative to dragged view
							y: grabY, // y position of touch relative to dragged view
							absoluteX, // x position of touch relative to parent of dragged view
							absoluteY, // y position of touch relative to parent of dragged view
						} = nativeEvent;

						/*
						 * First, verify that the touch is still within the dragged view.
						 * Because we are using a LongPressGestureHandler with unlimited
						 * distance to handle the drag, it could be out of bounds before
						 * it even starts. (For some reason, LongPressGestureHandler does
						 * not provide us with a BEGAN state change event.)
						 */
						if (grabX >= 0 && grabX <= width && grabY >= 0 && grabY <= height) {
							/*
							* To determine drag start position in screen coordinates, we add:
							*   screen coordinates of dragged view
							*   + relative coordinates of touch within view
							*/
							const screenStartPosition = {
								x: screenX + grabX,
								y: screenY + grabY,
							};
							const parentStartPosition = {
								x: absoluteX,
								y: absoluteY,
							};
							const {
								activity: { dragOffset },
								protocol: {
									dragReleaseAnimationDelay = defaultDragReleaseAnimationDelay,
									dragReleaseAnimationDuration = defaultDragReleaseAnimationDuration,
								},
							} = draggedData;
							dragTrackingRef.current = {
								screenStartPosition,
								parentStartPosition,
								dragged: {
									id,
									dragOffset,
									dragReleaseAnimationDelay,
									dragReleaseAnimationDuration,
								},
								// No receiver yet
							};
							if (debug) {
								console.log(`Start dragging view id ${id} at screen position (${screenStartPosition.x}, ${screenStartPosition.y})`);
							}
							draggedData.protocol.onDragStart?.();
							updateActivity({
								id,
								activity: { dragState: DraxDraggedViewState.Dragging },
							});
							// TODO: remove? dragOffset.setValue({ x: 0, y: 0 });
						}
					}
				}
			}
		},
		[
			getViewData,
			resetDrag,
			updateActivity,
			debug,
		],
	);
	const handleGestureEvent = useCallback(
		(id: string, { nativeEvent }: LongPressGestureHandlerGestureEvent) => {
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

			const draggedData = getViewData(draggedId);
			if (!draggedData) {
				// The drag we're tracking is for a view that's no longer registered. Reset.
				resetDrag();
				return;
			}

			/*
			 * To determine drag position in screen coordinates, we add:
			 *   screen coordinates of drag start
			 *   + translation offset of drag
			 */
			const { screenStartPosition, parentStartPosition } = dragTracking;
			const translation = {
				x: nativeEvent.absoluteX - parentStartPosition.x,
				y: nativeEvent.absoluteY - parentStartPosition.y,
			};
			const dragScreen = {
				x: screenStartPosition.x + translation.x,
				y: screenStartPosition.y + translation.y,
			};

			if (debug) {
				// We cannot be in a dragging state without measurements. (See handleGestureStateChange above.)
				const draggedMeasurements = draggedData.measurements!;
				console.log(`Dragged item screen coordinates (${draggedMeasurements.screenX}, ${draggedMeasurements.screenY})`);
				console.log(`Native event in-view touch coordinates: (${nativeEvent.x}, ${nativeEvent.y})`);
				console.log(`Drag translation (${translation.x}, ${translation.y})`);
				console.log(`Drag at screen coordinates (${dragScreen.x}, ${dragScreen.y})\n`);
			}

			const receiver = findReceiver(dragScreen.x, dragScreen.y, draggedId);
			const oldReceiverId = dragTracking.receiver?.id;

			// Always update the drag animation offset.
			draggedData.activity.dragOffset.setValue({ x: translation.x, y: translation.y });

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
					screenX: receiverScreenX,
					screenY: receiverScreenY,
				} = receiverData.measurements!;

				// Update the current receiver animation offset.
				receiverData.activity.receiverOffset.setValue({
					x: dragScreen.x - receiverScreenX,
					y: dragScreen.y - receiverScreenY,
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
						const oldReceiverProtocol = getViewData(oldReceiverId)?.protocol;
						draggedProtocol.onDragExit?.(oldReceiverProtocol?.receiverPayload);
						oldReceiverProtocol?.onReceiveDragExit?.(draggedProtocol.dragPayload);

						// ...and entering the new receiver.
						draggedProtocol.onDragEnter?.(receiverProtocol?.receiverPayload);
						receiverProtocol.onReceiveDragEnter?.(draggedProtocol.dragPayload);

						// Prepare receiver activity update for old receiver...
						activities.push({
							id: oldReceiverId,
							activity: {
								receiverState: DraxReceiverViewState.Inactive,
								receivingDragPayload: undefined,
							},
						});

						// ...and for new receiver.
						activities.push({
							id: receiverId,
							activity: {
								receiverState: DraxReceiverViewState.Receiving,
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
							receiverState: DraxReceiverViewState.Receiving,
							receivingDragPayload: draggedProtocol.dragPayload,
						},
					});
				}
			} else if (oldReceiverId) {
				// Case 4: new does not exist, old exists

				// Reset the old receiver. (Includes activity update.)
				resetReceiver();

				// Call the protocol event callbacks for exiting the old receiver.
				const oldReceiverProtocol = getViewData(oldReceiverId)?.protocol;
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
			getViewData,
			updateActivities,
			findReceiver,
			resetDrag,
			resetReceiver,
			debug,
		],
	);
	const getTrackingStatus = useCallback(
		(): DraxTrackingStatus => ({
			dragging: !!dragTrackingRef.current?.dragged,
			receiving: !!dragTrackingRef.current?.receiver,
		}),
		[dragTrackingRef],
	);
	useEffect(() => {
		if (debug) {
			console.log(`Rendering drax state: ${JSON.stringify(state, null, 2)}`);
		}
	});
	const value: DraxContextValue = {
		getViewData,
		getTrackingStatus,
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
