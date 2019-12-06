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
		registration,
		children,
		...props
	}: PropsWithChildren<DraxViewProps>,
): ReactElement => {
	const [id, setId] = useState(''); // The unique identifer for this view, initialized below.
	const ref = useRef<AnimatedViewRef>(null); // Ref to the underlying Animated.View, used for measuring.
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

	// Initialize id once.
	useEffect(() => { setId(uuid()); }, []);

	// Register and unregister with Drax context when necessary.
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

	// Connect gesture state change handling into Drax context, tied to this id.
	const onHandlerStateChange = useCallback(
		(event: LongPressGestureHandlerStateChangeEvent) => handleGestureStateChange(id, event),
		[id, handleGestureStateChange],
	);

	// Connect gesture event handling into Drax context, tied to this id.
	const onGestureEvent = useCallback(
		(event: LongPressGestureHandlerGestureEvent) => handleGestureEvent(id, event),
		[id, handleGestureEvent],
	);

	/*
	 * Measure and send our measurements to Drax context, used when
	 * we finish layout or receive a manual request,
	 */
	const measure = useCallback(
		() => {
			ref.current?.getNode().measureInWindow((x, y, width, height) => {
				console.log(`measureInWindow success callback: ${x}, ${y}, ${width}, ${height}`);
				/*
				 * In certain cases (on Android), all of these values can be
				 * undefined when the view is not on screen; for those, we
				 * send undefined for the entire measurements object.
				 */
				measureView({
					id,
					measurements: (height === undefined
						? undefined
						: {
							width,
							height,
							screenX: x,
							screenY: y,
						}
					),
				});
			});
		},
		[id, measureView],
	);

	// Register and unregister externally when necessary.
	useEffect(
		() => {
			if (id && registration) { // Register externally when we have an id and registration is set.
				registration({
					id,
					measure,
				});
				return () => registration(undefined); // Unregister when we unmount or registration changes.
			}
			return undefined;
		},
		[id, registration, measure],
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
				onLayout={measure}
				collapsable={false}
			>
				{children}
			</Animated.View>
		</LongPressGestureHandler>
	);
};
