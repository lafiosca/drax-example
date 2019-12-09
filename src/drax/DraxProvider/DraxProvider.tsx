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
	DraxViewData,
	DraxFoundView,
	DraxViewMeasurements,
	DraxMonitorEventData,
	Position,
} from '../types';
import {
	defaultDragReleaseAnimationDelay,
	defaultDragReleaseAnimationDuration,
} from '../params';
import { DraxContext } from '../DraxContext';
import { clipMeasurements, isPointInside, getRelativePosition } from '../math';

export const DraxProvider: FunctionComponent<DraxProviderProps> = ({ debug = false, children }) => {
	// Primary state reducer for registering views and storing view data.
	const [state, dispatch] = useReducer(reducer, initialState);

	// Information about currently tracked drag, if any.
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
					const { id } = receiver;
					dragTracking.receiver = undefined;
					updateActivity({
						id,
						activity: {
							receiverState: DraxReceiverViewState.Inactive,
							receiverOffset: undefined,
							receiverOffsetRatio: undefined,
							receivingDrag: undefined,
						},
					});
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
						grabOffset: undefined,
						grabOffsetRatio: undefined,
						draggingOverReceiver: undefined,
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

	const getAbsoluteMeasurements = useCallback(
		({ measurements, parentId }: DraxViewData): DraxViewMeasurements | undefined => {
			if (!measurements) {
				return undefined;
			}
			if (!parentId) {
				return measurements;
			}
			const parentViewData = getViewData(parentId);
			if (!parentViewData) {
				return undefined;
			}
			const parentMeasurements = getAbsoluteMeasurements(parentViewData);
			if (!parentMeasurements) {
				return undefined;
			}
			const {
				x,
				y,
				width,
				height,
			} = measurements;
			const {
				x: parentX,
				y: parentY,
			} = parentMeasurements;
			const { x: offsetX, y: offsetY } = parentViewData.scrollPositionRef?.current || { x: 0, y: 0 };
			const abs: DraxViewMeasurements = {
				width,
				height,
				x: parentX + x - offsetX,
				y: parentY + y - offsetY,
			};
			return clipMeasurements(abs, parentMeasurements);
		},
		[getViewData],
	);

	const getAbsoluteViewData = useCallback(
		(id: string | undefined) => {
			const viewData = getViewData(id);
			if (!viewData) {
				return undefined;
			}
			const absoluteMeasurements = getAbsoluteMeasurements(viewData);
			if (!absoluteMeasurements) {
				return undefined;
			}
			return {
				...viewData,
				absoluteMeasurements,
			};
		},
		[getViewData, getAbsoluteMeasurements],
	);

	/*
	 * Find all monitoring views and the latest receptive view that
	 * contain the touch coordinates, excluding the specified view.
	 */
	const findMonitorsAndReceiver = useCallback(
		(screenPosition: Position, excludeViewId: string) => {
			const monitors: DraxFoundView[] = [];
			let receiver: DraxFoundView | undefined;

			state.viewIds.forEach((targetId) => {
				if (targetId === excludeViewId) {
					// Don't consider the excluded view.
					return;
				}

				const target = getViewData(targetId);

				if (!target) {
					// This should never happen, but just in case.
					return;
				}

				const { receptive, monitoring } = target.protocol;

				if (!receptive && !monitoring) {
					// Only consider receptive or monitoring views.
					return;
				}

				const absoluteMeasurements = getAbsoluteMeasurements(target);

				if (!absoluteMeasurements) {
					// Only consider views for which we have measure data.
					return;
				}

				if (isPointInside(screenPosition, absoluteMeasurements)) {
					// Drag point is within this target.
					const foundView: DraxFoundView = {
						id: targetId,
						data: {
							...target,
							absoluteMeasurements,
						},
						...getRelativePosition(screenPosition, absoluteMeasurements),
					};

					if (monitoring) {
						// Add it to the list of monitors.
						monitors.push(foundView);
					}

					if (receptive) {
						// It's the latest receiver found.
						receiver = foundView;
					}
				}
			});
			return {
				monitors,
				receiver,
			};
		},
		[state.viewIds, getViewData, getAbsoluteMeasurements],
	);

	const handleGestureStateChange = useCallback(
		(id: string, { nativeEvent }: LongPressGestureHandlerStateChangeEvent) => {
			if (debug) {
				console.log(`handleGestureStateChange(${id}, ${JSON.stringify(nativeEvent, null, 2)})`);
			}

			const dragTracking = dragTrackingRef.current;

			/*
			 * Case 1: We're already dragging a different view.
			 * Case 2: This view can't be found/measured.
			 * Case 3: This is the view we're already dragging.
			 *   Case 3a: The drag is not ending.
			 *   Case 3b: The drag is ending.
			 * Case 4: We're not already dragging a view.
			 *   Case 4a: This view is not draggable.
			 *   Case 4b: No drag is starting.
			 *   Case 4c: A drag is starting.
			 */

			if (dragTracking && dragTracking.dragged.id !== id) {
				// Case 1: We're already dragging a different view.

				if (debug) {
					console.log(`Ignoring gesture state change because another view is being dragged: ${dragTracking.dragged.id}`);
				}
				return;
			}

			const draggedData = getAbsoluteViewData(id);

			if (!draggedData) {
				// Case 2: This view can't be found/measured.

				if (debug) {
					console.log(`Ignoring gesture for view id ${id} because view data was not found`);
				}
				return;
			}

			/*
			 * Documentation on gesture handler state flow used in switches below:
			 * https://github.com/kmagiera/react-native-gesture-handler/blob/master/docs/state.md
			 */

			const {
				state: gestureState, // Used in switch logic below; see block comment above.
				x: grabX, // x position of touch relative to dragged view
				y: grabY, // y position of touch relative to dragged view
				absoluteX, // x position of touch relative to parent of dragged view
				absoluteY, // y position of touch relative to parent of dragged view
			} = nativeEvent;

			const {
				x: screenX, // x position of dragged view within screen
				y: screenY, // y position of dragged view within screen
				width, // width of dragged view
				height, // height of dragged view
			} = draggedData.absoluteMeasurements;

			if (dragTracking) {
				// Case 3: This is the view we're already dragging.

				let endDrag = false;
				let shouldDrop = false;

				switch (gestureState) {
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
						shouldDrop = true;
						break;
					default:
						if (debug) {
							console.warn(`Unrecognized gesture state ${gestureState} for dragged view`);
						}
						break;
				}

				if (!endDrag) {
					// Case 3a: The drag is not ending.

					return;
				}

				// Case 3b: The drag is ending.

				/*
					* To determine drag position in screen coordinates, we add:
					*   screen coordinates of drag start
					*   + translation offset of drag
					*/
				const { screenStartPosition, parentStartPosition } = dragTracking;
				const translation = {
					x: absoluteX - parentStartPosition.x,
					y: absoluteY - parentStartPosition.y,
				};
				const screenPosition = {
					x: screenStartPosition.x + translation.x,
					y: screenStartPosition.y + translation.y,
				};

				// Get data for receiver view (if any).
				const receiverId = dragTracking.receiver?.id;
				const receiverData = getAbsoluteViewData(receiverId);

				// Reset drag.
				resetDrag();

				if (receiverData && shouldDrop) {
					// It's a successful drop into a receiver, let them both know.
					draggedData.protocol.onDragDrop?.({
						screenPosition,
						receiver: {
							id: receiverId!,
							parentId: receiverData.parentId,
							payload: receiverData.protocol.receiverPayload,
						},
					});
					receiverData.protocol.onReceiveDragDrop?.({
						screenPosition,
						...getRelativePosition(screenPosition, receiverData.absoluteMeasurements),
						dragged: {
							id,
							parentId: draggedData.parentId,
							payload: draggedData.protocol.dragPayload,
						},
					});
					if (dragTracking.monitorIds.length > 0) {
						const monitorEventData = {
							screenPosition,
							dragged: {
								id,
								parentId: draggedData.parentId,
								payload: draggedData.protocol.dragPayload,
							},
							receiver: {
								id: receiverId!,
								parentId: receiverData.parentId,
								payload: receiverData.protocol.receiverPayload,
							},
						};
						dragTracking.monitorIds.forEach((monitorId) => {
							const monitorData = getAbsoluteViewData(monitorId);
							if (monitorData) {
								monitorData.protocol.onMonitorDragDrop?.({
									...monitorEventData,
									...getRelativePosition(screenPosition, monitorData.absoluteMeasurements),
								});
							}
						});
					}
				} else {
					// There is no receiver, or the drag was cancelled.

					// Let the dragged item know the drag ended.
					draggedData.protocol.onDragEnd?.({ screenPosition });

					// If there is a receiver, let it know the drag exited it.
					if (receiverData) {
						receiverData.protocol.onReceiveDragExit?.({
							screenPosition,
							...getRelativePosition(screenPosition, receiverData.absoluteMeasurements),
							dragged: {
								id,
								parentId: draggedData.parentId,
								payload: draggedData.protocol.dragPayload,
							},
						});
					}

					if (dragTracking.monitorIds.length > 0) {
						const monitorEventData = {
							screenPosition,
							dragged: {
								id,
								parentId: draggedData.parentId,
								payload: draggedData.protocol.dragPayload,
							},
						};
						dragTracking.monitorIds.forEach((monitorId) => {
							const monitorData = getAbsoluteViewData(monitorId);
							if (monitorData) {
								monitorData.protocol.onMonitorDragExit?.({
									...monitorEventData,
									...getRelativePosition(screenPosition, monitorData.absoluteMeasurements),
								});
							}
						});
					}
				}

				return;
			}

			// Case 4: We're not already dragging a view.

			if (!draggedData.protocol.draggable) {
				// Case 4a: This view is not draggable.

				if (debug) {
					console.log(`Ignoring gesture for undraggable view id ${id}`);
				}
				return;
			}

			let startDrag = false;

			switch (gestureState) {
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
						console.warn(`Unrecognized gesture state ${gestureState} for non-dragged view id ${id}`);
					}
					break;
			}

			if (!startDrag) {
				// Case 4b: No drag is starting.

				return;
			}

			// Case 4c: A drag is starting.

			/*
			* First, verify that the touch is still within the dragged view.
			* Because we are using a LongPressGestureHandler with unlimited
			* distance to handle the drag, it could be out of bounds before
			* it even starts. (For some reason, LongPressGestureHandler does
			* not provide us with a BEGAN state change event in iOS.)
			*/
			if (grabX >= 0 && grabY >= 0 && grabX < width && grabY < height) {
				/*
				* To determine drag start position in screen coordinates, we add:
				*   screen coordinates of dragged view
				*   + relative coordinates of touch within view
				*
				* NOTE: if view is already transformed, these will be wrong.
				*/
				const screenPosition = {
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
					screenStartPosition: screenPosition,
					parentStartPosition,
					dragged: {
						id,
						dragOffset,
						dragReleaseAnimationDelay,
						dragReleaseAnimationDuration,
					},
					monitorIds: [],
					// (No receiver yet)
				};
				if (debug) {
					console.log(`Start dragging view id ${id} at screen position (${screenPosition.x}, ${screenPosition.y})`);
				}
				draggedData.protocol.onDragStart?.({ screenPosition });
				updateActivity({
					id,
					activity: {
						dragState: DraxDraggedViewState.Dragging,
						grabOffset: { x: grabX, y: grabY },
						grabOffsetRatio: {
							x: grabX / width,
							y: grabY / height,
						},
					},
				});
			}
		},
		[
			getAbsoluteViewData,
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
			const screenPosition = {
				x: screenStartPosition.x + translation.x,
				y: screenStartPosition.y + translation.y,
			};

			if (debug) {
				const draggedMeasurements = getAbsoluteMeasurements(draggedData);
				console.log(`Dragged item screen coordinates (${draggedMeasurements?.x}, ${draggedMeasurements?.y})`);
				console.log(`Native event in-view touch coordinates: (${nativeEvent.x}, ${nativeEvent.y})`);
				console.log(`Drag translation (${translation.x}, ${translation.y})`);
				console.log(`Drag at screen coordinates (${screenPosition.x}, ${screenPosition.y})\n`);
			}

			// Find which monitors and receiver this drag is over.
			const { monitors, receiver } = findMonitorsAndReceiver(screenPosition, draggedId);

			// Get the previous receiver id, if any.
			const oldReceiverId = dragTracking.receiver?.id;

			// Always update the drag animation offset.
			draggedData.activity.dragOffset.setValue({ x: translation.x, y: translation.y });

			const draggedProtocol = draggedData.protocol;
			const eventDataDragged = {
				id: draggedId,
				parentId: draggedData.parentId,
				payload: draggedData.protocol.dragPayload,
			};
			const eventDataReceiver = receiver && {
				id: receiver.id,
				parentId: receiver.data.parentId,
				payload: receiver.data.protocol.receiverPayload,
			};

			// Notify monitors and update monitor tracking, if necessary.
			if (monitors.length > 0 || dragTracking.monitorIds.length > 0) {
				const baseMonitorEventData = {
					screenPosition,
					dragged: eventDataDragged,
					receiver: eventDataReceiver,
				};
				const newMonitorIds = monitors.map(({
					relativePosition,
					relativePositionRatio,
					id: monitorId,
					data: monitorData,
				}) => {
					const monitorEventData = {
						...baseMonitorEventData,
						relativePosition,
						relativePositionRatio,
					};
					if (dragTracking.monitorIds.includes(monitorId)) {
						// Drag was already over this monitor.
						monitorData.protocol.onMonitorDragOver?.(monitorEventData);
					} else {
						// Drag is entering monitor.
						monitorData.protocol.onMonitorDragEnter?.(monitorEventData);
					}
					return monitorId;
				});
				dragTracking.monitorIds.filter((monitorId) => !newMonitorIds.includes(monitorId))
					.forEach((monitorId) => {
						// Drag has exited monitor.
						const monitorData = getAbsoluteViewData(monitorId);
						if (monitorData) {
							monitorData.protocol.onMonitorDragExit?.({
								...baseMonitorEventData,
								...getRelativePosition(screenPosition, monitorData.absoluteMeasurements),
							});
						}
					});
				dragTracking.monitorIds = newMonitorIds;
			}

			/*
			 * Consider the following cases for new and old receiver ids:
			 * Case 1: new exists, old exists, new is the same as old
			 * Case 2: new exists, old exists, new is different from old
			 * Case 3: new exists, old does not exist
			 * Case 4: new does not exist, old exists
			 * Case 5: new does not exist, old does not exist
			 */

			const activities: UpdateActivityPayload[] = [];

			if (receiver) {
				// New receiver exists.
				const { id: receiverId, data: receiverData } = receiver;
				const receiverProtocol = receiverData.protocol;
				const { receiverPayload } = receiverProtocol;

				const dragEventData = {
					screenPosition,
					receiver: eventDataReceiver!,
				};

				const receiveEventData = {
					screenPosition,
					relativePosition: receiver.relativePosition,
					relativePositionRatio: receiver.relativePositionRatio,
					dragged: eventDataDragged,
				};

				// Prepare activity update for the receiver.
				activities.push({
					id: receiverId,
					activity: {
						receiverState: DraxReceiverViewState.Receiving,
						receiverOffset: receiver.relativePosition,
						receiverOffsetRatio: receiver.relativePositionRatio,
						receivingDrag: {
							id: draggedId,
							parentId: draggedData.parentId,
							payload: draggedProtocol.dragPayload,
						},
					},
				});

				// Prepare activity update for dragged item, if necessary.
				if (draggedData.activity.draggingOverReceiver?.id !== receiverId
					|| draggedData.activity.draggingOverReceiver?.payload !== receiverPayload) {
					activities.push({
						id: draggedId,
						activity: {
							draggingOverReceiver: {
								id: receiverId,
								parentId: receiverData.parentId,
								payload: receiverPayload,
							},
						},
					});
				}

				if (oldReceiverId) {
					if (receiverId === oldReceiverId) {
						// Case 1: new exists, old exists, new is the same as old

						// Call the protocol event callbacks for dragging over the receiver.
						draggedProtocol.onDragOver?.(dragEventData);
						receiverProtocol.onReceiveDragOver?.(receiveEventData);
					} else {
						// Case 2: new exists, old exists, new is different from old

						// Reset the old receiver. (Includes activity update.)
						resetReceiver();

						// Set the new receiver.
						dragTracking.receiver = { id: receiverId };

						// Get the old receiver data.
						const oldReceiverData = getAbsoluteViewData(oldReceiverId);

						// Call the protocol event callbacks for exiting the old receiver...
						draggedProtocol.onDragExit?.({
							screenPosition,
							receiver: {
								id: oldReceiverId,
								parentId: oldReceiverData?.parentId,
								payload: oldReceiverData?.protocol.receiverPayload,
							},
						});
						if (oldReceiverData) {
							oldReceiverData.protocol.onReceiveDragExit?.({
								screenPosition,
								...getRelativePosition(screenPosition, oldReceiverData.absoluteMeasurements),
								dragged: eventDataDragged,
							});
						}

						// ...and entering the new receiver.
						draggedProtocol.onDragEnter?.(dragEventData);
						receiverProtocol.onReceiveDragEnter?.(receiveEventData);
					}
				} else {
					// Case 3: new exists, old does not exist

					// Set the new receiver.
					dragTracking.receiver = { id: receiverId };

					// Call the protocol event callbacks for entering the new receiver.
					draggedProtocol.onDragEnter?.(dragEventData);
					receiverProtocol.onReceiveDragEnter?.(receiveEventData);
				}
			} else if (oldReceiverId) {
				// Case 4: new does not exist, old exists

				// Reset the old receiver. (Includes activity update.)
				resetReceiver();

				// Get the old receiver data.
				const oldReceiverData = getAbsoluteViewData(oldReceiverId);

				// Prepare activity update for dragged item.
				activities.push({
					id: draggedId,
					activity: { draggingOverReceiver: undefined },
				});

				// Call the protocol event callbacks for exiting the old receiver.
				draggedProtocol.onDragExit?.({
					screenPosition,
					receiver: {
						id: oldReceiverId,
						parentId: oldReceiverData?.parentId,
						payload: oldReceiverData?.protocol.receiverPayload,
					},
				});
				if (oldReceiverData) {
					oldReceiverData.protocol.onReceiveDragExit?.({
						screenPosition,
						...getRelativePosition(screenPosition, oldReceiverData.absoluteMeasurements),
						dragged: eventDataDragged,
					});
				}
			} else {
				// Case 5: new does not exist, old does not exist

				// Call the protocol event callback for dragging.
				draggedProtocol.onDrag?.({ screenPosition });
			}

			// If there are any updates queued, dispatch them now.
			if (activities.length > 0) {
				updateActivities({ activities });
			}
		},
		[
			getViewData,
			getAbsoluteViewData,
			getAbsoluteMeasurements,
			updateActivities,
			findMonitorsAndReceiver,
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
