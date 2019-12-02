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
	PanGestureHandlerStateChangeEvent,
	PanGestureHandlerGestureEvent,
	PanGestureHandler,
} from 'react-native-gesture-handler';
import uuid from 'uuid/v4';

import { useDrax } from './useDrax';
import {
	DraxViewProps,
	AnimatedViewRef,
	DraxDraggedViewState,
	DraxReceiverViewState,
} from './types';

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
		(event: PanGestureHandlerStateChangeEvent) => handleGestureStateChange(id, event),
		[id, handleGestureStateChange],
	);
	const onGestureEvent = useCallback(
		// Wire gesture event handling into Drax context, tied to this id.
		(event: PanGestureHandlerGestureEvent) => handleGestureEvent(id, event),
		[id, handleGestureEvent],
	);
	const onLayout = useCallback(
		() => {
			// Every time we finish layout, measure and send our measurements to Drax context.
			ref.current?.getNode().measure((x, y, width, height, screenX, screenY) => measureView({
				id,
				measurements: {
					width,
					height,
					screenX,
					screenY,
				},
			}));
		},
		[id, measureView],
	);
	const activity = getViewData(id)?.activity;
	const { dragging, receiving } = getTrackingStatus();
	const styles: any[] = [style];
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
		<PanGestureHandler
			onHandlerStateChange={onHandlerStateChange}
			onGestureEvent={onGestureEvent}
		>
			<Animated.View
				{...props}
				ref={ref}
				style={styles}
				onLayout={onLayout}
			>
				{children}
			</Animated.View>
		</PanGestureHandler>
	);
};
