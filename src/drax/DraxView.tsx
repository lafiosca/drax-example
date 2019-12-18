import React, {
	PropsWithChildren,
	ReactElement,
	useState,
	useRef,
	useEffect,
	useCallback,
	useMemo,
} from 'react';
import { Animated, findNodeHandle, View } from 'react-native';
import {
	LongPressGestureHandlerStateChangeEvent,
	LongPressGestureHandler,
} from 'react-native-gesture-handler';
import uuid from 'uuid/v4';
import throttle from 'lodash.throttle';

import { useDrax } from './useDrax';
import {
	LongPressGestureHandlerGestureEvent,
	DraxViewProps,
	AnimatedViewRefType,
	DraxViewDragStatus,
	DraxViewReceiveStatus,
	DraxGestureEvent,
	DraxHoverViewProps,
	DraxViewState,
	DraxViewMeasurements,
	DraxViewMeasurementHandler,
} from './types';
import { defaultLongPressDelay } from './params';
import { DraxSubprovider } from './DraxSubprovider';

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
		onMonitorDragStart,
		onMonitorDragEnter,
		onMonitorDragOver,
		onMonitorDragExit,
		onMonitorDragEnd,
		onMonitorDragDrop,
		animateSnapback,
		snapbackDelay,
		snapbackDuration,
		payload,
		dragPayload,
		receiverPayload,
		style,
		dragInactiveStyle,
		draggingStyle,
		draggingWithReceiverStyle,
		draggingWithoutReceiverStyle,
		dragReleasedStyle,
		hoverStyle,
		hoverDraggingStyle,
		hoverDraggingWithReceiverStyle,
		hoverDraggingWithoutReceiverStyle,
		hoverDragReleasedStyle,
		receiverInactiveStyle,
		receivingStyle,
		otherDraggingStyle,
		otherDraggingWithReceiverStyle,
		otherDraggingWithoutReceiverStyle,
		registration,
		onMeasure,
		scrollPositionRef,
		children,
		longPressDelay = defaultLongPressDelay,
		id: idProp,
		parent: parentProp,
		draggable: draggableProp,
		receptive: receptiveProp,
		monitoring: monitoringProp,
		...props
	}: PropsWithChildren<DraxViewProps>,
): ReactElement => {
	// Coalesce protocol props into capabilities.
	const draggable = draggableProp ?? (
		dragPayload !== undefined
		|| payload !== undefined
		|| !!onDrag
		|| !!onDragEnd
		|| !!onDragEnter
		|| !!onDragExit
		|| !!onDragOver
		|| !!onDragStart
		|| !!onDragDrop
	);
	const receptive = receptiveProp ?? (
		receiverPayload !== undefined
		|| payload !== undefined
		|| !!onReceiveDragEnter
		|| !!onReceiveDragExit
		|| !!onReceiveDragOver
		|| !!onReceiveDragDrop
	);
	const monitoring = monitoringProp ?? (
		!!onMonitorDragStart
		|| !!onMonitorDragEnter
		|| !!onMonitorDragOver
		|| !!onMonitorDragExit
		|| !!onMonitorDragEnd
		|| !!onMonitorDragDrop
	);

	// The unique identifer for this view, initialized below.
	const [id, setId] = useState('');

	// The underlying View, for measuring.
	const viewRef = useRef<View | null>(null);

	// The underlying View node handle, used for subprovider nesting.
	const nodeHandleRef = useRef<number | null>(null);

	// This view's measurements, for reference.
	const measurementsRef = useRef<DraxViewMeasurements | undefined>(undefined);


	// Connect with Drax.
	const {
		getViewState,
		getTrackingStatus,
		registerView,
		unregisterView,
		updateViewProtocol,
		updateViewMeasurements,
		handleGestureEvent,
		handleGestureStateChange,
		parent: contextParent,
	} = useDrax();

	// Identify parent Drax view (if any) from context or prop override.
	const parent = parentProp ?? contextParent;
	const parentId = parent && parent.id;

	// Initialize id.
	useEffect(
		() => {
			if (idProp) {
				if (id !== idProp) {
					setId(idProp);
				}
			} else if (!id) {
				setId(uuid());
			}
		},
		[id, idProp],
	);

	// Register and unregister with Drax context when necessary.
	useEffect(
		() => {
			if (id) {
				// Register with Drax context after we have an id.
				registerView({ id, parentId, scrollPositionRef });

				// Unregister when we unmount.
				return () => unregisterView({ id });
			}
			return undefined;
		},
		[
			id,
			parentId,
			scrollPositionRef,
			registerView,
			unregisterView,
		],
	);

	const getHoverStyles = useCallback(
		({ dragStatus, draggingOverReceiver }: DraxViewState) => {
			const hoverStyles = [];
			const measurements = measurementsRef.current;
			if (measurements) {
				hoverStyles.push({
					width: measurements.width,
					height: measurements.height,
				});
			}
			hoverStyles.push(style);
			hoverStyles.push(hoverStyle);
			if (dragStatus === DraxViewDragStatus.Dragging) {
				hoverStyles.push(hoverDraggingStyle);
				if (draggingOverReceiver) {
					hoverStyles.push(hoverDraggingWithReceiverStyle);
				} else {
					hoverStyles.push(hoverDraggingWithoutReceiverStyle);
				}
			} else if (dragStatus === DraxViewDragStatus.Released) {
				hoverStyles.push(hoverDragReleasedStyle);
			}
			return hoverStyles;
		},
		[
			style,
			hoverStyle,
			hoverDraggingStyle,
			hoverDraggingWithReceiverStyle,
			hoverDraggingWithoutReceiverStyle,
			hoverDragReleasedStyle,
		],
	);

	const renderHoverView = useCallback(
		({ viewState }: DraxHoverViewProps) => {
			if (!draggable) {
				return undefined;
			}

			return (
				<Animated.View
					{...props}
					style={getHoverStyles(viewState)}
				>
					{children}
				</Animated.View>
			);
		},
		[
			draggable,
			props,
			getHoverStyles,
			children,
		],
	);

	// Report updates to our protocol callbacks when we have an id and whenever the props change.
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
						onMonitorDragStart,
						onMonitorDragEnter,
						onMonitorDragOver,
						onMonitorDragExit,
						onMonitorDragEnd,
						onMonitorDragDrop,
						animateSnapback,
						snapbackDelay,
						snapbackDuration,
						renderHoverView,
						draggable,
						receptive,
						monitoring,
						dragPayload: dragPayload ?? payload,
						receiverPayload: receiverPayload ?? payload,
					},
				});
			}
		},
		[
			id,
			updateViewProtocol,
			children,
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
			onMonitorDragStart,
			onMonitorDragEnter,
			onMonitorDragOver,
			onMonitorDragExit,
			onMonitorDragEnd,
			onMonitorDragDrop,
			animateSnapback,
			snapbackDelay,
			snapbackDuration,
			payload,
			dragPayload,
			receiverPayload,
			draggable,
			receptive,
			monitoring,
			renderHoverView,
		],
	);

	// Connect gesture state change handling into Drax context, tied to this id.
	const onHandlerStateChange = useCallback(
		({ nativeEvent }: LongPressGestureHandlerStateChangeEvent) => handleGestureStateChange(id, nativeEvent),
		[id, handleGestureStateChange],
	);

	// Create throttled gesture event handler, tied to this id.
	const throttledHandleGestureEvent = useCallback(
		throttle(
			(event: DraxGestureEvent) => {
				// Pass the event up to the Drax context.
				handleGestureEvent(id, event);
			},
			33,
		),
		[id, handleGestureEvent],
	);

	// Connect gesture event handling into Drax context, extracting nativeEvent.
	const onGestureEvent = useCallback(
		(event: LongPressGestureHandlerGestureEvent) => throttledHandleGestureEvent(event.nativeEvent),
		[throttledHandleGestureEvent],
	);

	// Build a callback which will report our measurements to Drax context,
	// onMeasure, and an optional measurement handler.
	const buildMeasureCallback = useCallback(
		(measurementHandler?: DraxViewMeasurementHandler) => (
			(x?: number, y?: number, width?: number, height?: number) => {
				/*
				 * In certain cases (on Android), all of these values can be
				 * undefined when the view is not on screen; This should not
				 * happen with the measurement functions we're using, but just
				 * for the sake of paranoia, we'll check and use undefined
				 * for the entire measurements object.
				 */
				const measurements: DraxViewMeasurements | undefined = (
					height === undefined
						? undefined
						: {
							height,
							x: x!,
							y: y!,
							width: width!,
						}
				);
				measurementsRef.current = measurements;
				updateViewMeasurements({ id, measurements });
				onMeasure?.(measurements);
				measurementHandler?.(measurements);
			}
		),
		[id, updateViewMeasurements, onMeasure],
	);

	// Callback which will report our measurements to Drax context and onMeasure.
	const updateMeasurements = useMemo(
		() => buildMeasureCallback(),
		[buildMeasureCallback],
	);

	// Measure and report our measurements to Drax context, onMeasure, and an
	// optional measurement handler on demand.
	const measureWithHandler = useCallback(
		(measurementHandler?: DraxViewMeasurementHandler) => {
			const view = viewRef.current;
			if (view) {
				const measureCallback = measurementHandler
					? buildMeasureCallback(measurementHandler)
					: updateMeasurements;
				if (parent) {
					const nodeHandle = parent.nodeHandleRef.current;
					if (nodeHandle) {
						view.measureLayout(
							nodeHandle,
							measureCallback,
							() => {
								console.log('Failed to measure drax view in relation to parent');
							},
						);
					} else {
						console.log('No parent nodeHandle to measure drax view in relation to');
					}
				} else {
					view.measureInWindow(measureCallback);
				}
			}
		},
		[parent, buildMeasureCallback, updateMeasurements],
	);

	// Measure and send our measurements to Drax context and onMeasure, used when this view finishes layout.
	const onLayout = useCallback(
		() => {
			console.log(`onLayout ${id}`);
			measureWithHandler();
		},
		[id, measureWithHandler],
	);

	// Register and unregister externally when necessary.
	useEffect(
		() => {
			if (id && registration) { // Register externally when we have an id and registration is set.
				registration({
					id,
					measure: measureWithHandler,
				});
				return () => registration(undefined); // Unregister when we unmount or registration changes.
			}
			return undefined;
		},
		[id, registration, measureWithHandler],
	);

	// useEffect(
	// 	() => {
	// 		console.log('throttle function replaced');
	// 	},
	// 	[throttledHandleGestureEvent],
	// );

	const styles = useMemo(
		() => {
			const styles = [style];

			const {
				dragStatus = DraxViewDragStatus.Inactive,
				receiveStatus = DraxViewReceiveStatus.Inactive,
			} = getViewState(id) ?? {};

			const {
				dragging: anyDragging,
				receiving: anyReceiving,
			} = getTrackingStatus();

			// First apply style overrides for drag state.
			if (dragStatus === DraxViewDragStatus.Dragging) {
				styles.push(draggingStyle);
				if (anyReceiving) {
					styles.push(draggingWithReceiverStyle);
				} else {
					styles.push(draggingWithoutReceiverStyle);
				}
			} else if (dragStatus === DraxViewDragStatus.Released) {
				styles.push(dragReleasedStyle);
			} else {
				styles.push(dragInactiveStyle);
				if (anyDragging) {
					styles.push(otherDraggingStyle);
					if (anyReceiving) {
						styles.push(otherDraggingWithReceiverStyle);
					} else {
						styles.push(otherDraggingWithoutReceiverStyle);
					}
				}
			}

			// Next apply style overrides for receiving state.
			if (receiveStatus === DraxViewReceiveStatus.Receiving) {
				styles.push(receivingStyle);
			} else {
				styles.push(receiverInactiveStyle);
			}

			return styles;
		},
		[
			id,
			getViewState,
			getTrackingStatus,
			style,
			dragInactiveStyle,
			draggingStyle,
			draggingWithReceiverStyle,
			draggingWithoutReceiverStyle,
			dragReleasedStyle,
			receivingStyle,
			receiverInactiveStyle,
			otherDraggingStyle,
			otherDraggingWithReceiverStyle,
			otherDraggingWithoutReceiverStyle,
		],
	);

	return (
		<LongPressGestureHandler
			maxDist={Number.MAX_SAFE_INTEGER}
			shouldCancelWhenOutside={false}
			minDurationMs={longPressDelay}
			onHandlerStateChange={onHandlerStateChange}
			onGestureEvent={onGestureEvent as any /* Workaround incorrect typings. */}
			enabled={draggable}
		>
			<Animated.View
				{...props}
				ref={(ref: AnimatedViewRefType | null) => {
					const view = ref && ref.getNode();
					viewRef.current = view;
					nodeHandleRef.current = view && findNodeHandle(view);
				}}
				style={styles}
				onLayout={onLayout}
				collapsable={false}
			>
				<DraxSubprovider parent={{ id, nodeHandleRef }}>
					{children}
				</DraxSubprovider>
			</Animated.View>
		</LongPressGestureHandler>
	);
};
