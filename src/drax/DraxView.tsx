import React, {
	PropsWithChildren,
	ReactElement,
	useState,
	useRef,
	useEffect,
	useCallback,
} from 'react';
import { Animated } from 'react-native';
import {
	LongPressGestureHandlerStateChangeEvent,
	LongPressGestureHandlerGestureEvent,
	LongPressGestureHandler,
} from 'react-native-gesture-handler';
import uuid from 'uuid/v4';

import { useDrax } from './useDrax';
import {
	DraxViewProps,
	AnimatedViewRef,
	DraxDraggedViewState,
	DraxReceiverViewState,
} from './types';

const defaultStyle = {
	width: 'auto',
	height: 'auto',
};

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
		dragReleaseAnimationDelay,
		dragReleaseAnimationDuration,
		payload,
		dragPayload,
		receiverPayload,
		draggable,
		receptive,
		translateDrag = true,
		style,
		dragInactiveStyle,
		draggingStyle,
		draggingWithReceiverStyle,
		draggingWithoutReceiverStyle,
		dragReleasedStyle,
		receiverInactiveStyle,
		receivingStyle,
		otherDraggingStyle,
		otherDraggingWithReceiverStyle,
		otherDraggingWithoutReceiverStyle,
		children,
		...props
	}: PropsWithChildren<DraxViewProps>,
): ReactElement => {
	const [id, setId] = useState(''); // The unique identifer for this view, initialized below.
	const ref = useRef<AnimatedViewRef>(null);
	const {
		getViewData,
		getTrackingStatus,
		registerView,
		unregisterView,
		updateViewProtocol,
		measureView,
		handleGestureEvent,
		handleGestureStateChange,
	} = useDrax();
	useEffect(() => { setId(uuid()); }, []); // Initialize id once.
	useEffect(
		() => {
			if (id) {
				registerView({ id }); // Register with Drax context after we have an id.
				return () => unregisterView({ id }); // Unregister when we unmount.
			}
			return undefined;
		},
		[id, registerView, unregisterView],
	);
	useEffect(
		() => {
			if (id) {
				// Update our protocol callbacks once we have an id and whenever these props change.
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
						dragReleaseAnimationDelay,
						dragReleaseAnimationDuration,
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
			dragReleaseAnimationDelay,
			dragReleaseAnimationDuration,
			payload,
			dragPayload,
			receiverPayload,
			draggable,
			receptive,
		],
	);
	const onHandlerStateChange = useCallback(
		// Wire gesture state change handling into Drax context, tied to this id.
		(event: LongPressGestureHandlerStateChangeEvent) => handleGestureStateChange(id, event),
		[id, handleGestureStateChange],
	);
	const onGestureEvent = useCallback(
		// Wire gesture event handling into Drax context, tied to this id.
		(event: LongPressGestureHandlerGestureEvent) => handleGestureEvent(id, event),
		[id, handleGestureEvent],
	);
	const onLayout = useCallback(
		() => {
			console.log('onLayout');
			if (ref.current) {
				console.log('measure');
			}
			// Every time we finish layout, measure and send our measurements to Drax context.
			ref.current?.getNode().measure((x, y, width, height, screenX, screenY) => {
				console.log(`Measure success callback: ${x}, ${y}, ${width}, ${height}, ${screenX}, ${screenY}`);
				if (x !== undefined) { // Don't dispatch with undefined values.
					measureView({
						id,
						measurements: {
							width,
							height,
							screenX,
							screenY,
						},
					});
				}
			});
		},
		[id, measureView],
	);

	// Retrieve data for building styles.
	const activity = getViewData(id)?.activity;
	const { dragging, receiving } = getTrackingStatus();

	// Use `any[]` here because the view style typings don't account for animated views.
	const styles: any[] = [
		defaultStyle,
		style,
	];
	if (activity) {
		// First apply style overrides for drag state.
		if (activity.dragState === DraxDraggedViewState.Dragging) {
			styles.push(draggingStyle);
			if (receiving) {
				styles.push(draggingWithReceiverStyle);
			} else {
				styles.push(draggingWithoutReceiverStyle);
			}
		} else if (activity.dragState === DraxDraggedViewState.Released) {
			styles.push(dragReleasedStyle);
		} else {
			styles.push(dragInactiveStyle);
			if (dragging) {
				styles.push(otherDraggingStyle);
				if (receiving) {
					styles.push(otherDraggingWithReceiverStyle);
				} else {
					styles.push(otherDraggingWithoutReceiverStyle);
				}
			}
		}

		// Next apply style overrides for receiving state.
		if (activity.receiverState === DraxReceiverViewState.Receiving) {
			styles.push(receivingStyle);
		} else {
			styles.push(receiverInactiveStyle);
		}

		// Finally apply drag translation/elevation.
		if (activity.dragState !== DraxDraggedViewState.Inactive && translateDrag) {
			styles.push({
				transform: activity.dragOffset.getTranslateTransform(),
				zIndex: 10, // Bring it up high, but this only works if Drax views are siblings.
				elevation: 10,
			});
		}
	}
	return (
		<LongPressGestureHandler
			maxDist={Number.MAX_SAFE_INTEGER}
			shouldCancelWhenOutside={false}
			minDurationMs={250}
			onHandlerStateChange={onHandlerStateChange}
			onGestureEvent={onGestureEvent}
		>
			<Animated.View
				{...props}
				ref={ref}
				style={styles}
				onLayout={onLayout}
				collapsable={false}
			>
				{children}
			</Animated.View>
		</LongPressGestureHandler>
	);
};
