import { RefObject } from 'react';
import {
	ViewProps,
	View,
	Animated,
	FlatListProperties,
} from 'react-native';
import {
	LongPressGestureHandlerStateChangeEvent,
	GestureHandlerGestureEvent,
	GestureHandlerGestureEventNativeEvent,
	LongPressGestureHandlerEventExtra,
} from 'react-native-gesture-handler';

/** Workaround for incorrect typings. See: https://github.com/kmagiera/react-native-gesture-handler/pull/860/files */
export interface LongPressGestureHandlerGestureEvent extends GestureHandlerGestureEvent {
	nativeEvent: GestureHandlerGestureEventNativeEvent & LongPressGestureHandlerEventExtra;
}

/** Measurements of a Drax view for bounds checking purposes */
export interface DraxViewMeasurements {
	/** x position of view within parent drax view or screen */
	x: number;
	/** y position of view within parent drax view or screen */
	y: number;
	/** Width of view */
	width: number;
	/** Height of view */
	height: number;
}

/** An xy-coordinate position value */
export interface Position {
	/** x position (horizontal, positive is right) */
	x: number;
	/** y position (vertical, positive is down) */
	y: number;
}

/** Data about a Drax event common to all protocol callbacks */
export interface DraxEventData {
	/** Position of the event in screen coordinates */
	screenPosition: Position;
}

/** Data about a Drax drag event */
export interface DraxDragEventData extends DraxEventData {}

/** Data about a view involved in a Drax event */
export interface DraxEventViewData {
	/** The view's id */
	id: string;
	/** The view's parent id, if any */
	parentId?: string;
	/** The view's payload for this event */
	payload: any;
}

/** Data about a Drax drag event that involves a receiver */
export interface DraxDragWithReceiverEventData extends DraxDragEventData {
	/** The receiver for the drag event */
	receiver: DraxEventViewData;
}

/** Data about a Drax receive event */
export interface DraxReceiveEventData extends DraxEventData {
	/** The dragged view for the receive event */
	dragged: DraxEventViewData;
	/** Event position relative to the receiver */
	relativePosition: Position;
	/** Event position/dimensions ratio relative to the receiver */
	relativePositionRatio: Position;
}

/** Data about a Drax monitor event */
export interface DraxMonitorEventData extends DraxEventData {
	/** The dragged view for the monitor event */
	dragged: DraxEventViewData;
	/** The receiver for the monitor event, if any */
	receiver?: DraxEventViewData;
	/** Event position relative to the monitor */
	relativePosition: Position;
	/** Event position/dimensions ratio relative to the monitor */
	relativePositionRatio: Position;
}

/** Callback protocol for communicating Drax events to views */
export interface DraxProtocol {
	/** Called in the dragged view when a drag action begins */
	onDragStart?: (data: DraxDragEventData) => void;

	/** Called in the dragged view repeatedly while dragged, not over any receiver */
	onDrag?: (data: DraxDragEventData) => void;

	/** Called in the dragged view when dragged onto a new receiver */
	onDragEnter?: (data: DraxDragWithReceiverEventData) => void;

	/** Called in the dragged view repeatedly while dragged over a receiver */
	onDragOver?: (data: DraxDragWithReceiverEventData) => void;

	/** Called in the dragged view when dragged off of a receiver */
	onDragExit?: (data: DraxDragWithReceiverEventData) => void;

	/** Called in the dragged view when drag ends or is cancelled, not over any receiver */
	onDragEnd?: (data: DraxDragEventData) => void;

	/** Called in the dragged view when drag ends over a receiver */
	onDragDrop?: (data: DraxDragWithReceiverEventData) => void;

	/** Called in the receiver view when an item is dragged onto it */
	onReceiveDragEnter?: (data: DraxReceiveEventData) => void;

	/** Called in the receiver view repeatedly while an item is dragged over it */
	onReceiveDragOver?: (data: DraxReceiveEventData) => void;

	/** Called in the receiver view when item is dragged off of it or drag is cancelled */
	onReceiveDragExit?: (data: DraxReceiveEventData) => void;

	/** Called in the receiver view when drag ends over it */
	onReceiveDragDrop?: (data: DraxReceiveEventData) => void;

	/** Called in the monitor view when an item is dragged onto it */
	onMonitorDragEnter?: (data: DraxMonitorEventData) => void;

	/** Called in the monitor view repeatedly while an item is dragged over it */
	onMonitorDragOver?: (data: DraxMonitorEventData) => void;

	/** Called in the monitor view when item is dragged off of it or drag is cancelled */
	onMonitorDragExit?: (data: DraxMonitorEventData) => void;

	/** Called in the monitor view when drag ends over it */
	onMonitorDragDrop?: (data: DraxMonitorEventData) => void;

	/** When releasing a drag of this view, delay in ms before it snaps back to inactive state */
	dragReleaseAnimationDelay?: number;

	/** When releasing a drag of this view, duration in ms for it to snap back to inactive state */
	dragReleaseAnimationDuration?: number;

	/** Payload that will be delivered to receiver views when this view is dragged; overrides `payload` */
	dragPayload?: any;

	/** Payload that will be delievered to dragged views when this view receives them; overrides `payload` */
	receiverPayload?: any;

	/** Whether the view can be dragged */
	draggable: boolean;

	/** Whether the view can receive drags */
	receptive: boolean;

	/** Whether the view can monitor drags */
	monitoring: boolean;
}

/** Props for components implementing the protocol */
export interface DraxProtocolProps extends Partial<DraxProtocol> {
	/** Convenience prop to provide one value for both `dragPayload` and `receiverPayload` */
	payload?: any;
}

/** The states a dragged view can be in */
export enum DraxDraggedViewState {
	/** View is not being dragged */
	Inactive,
	/** View is being actively dragged; an active drag touch began in this view */
	Dragging,
	/** View has been released but has not yet snapped back to inactive */
	Released,
}

/** The states a receiver view can be in */
export enum DraxReceiverViewState {
	/** View is not receiving a drag */
	Inactive,
	/** View is receiving a drag; an active drag touch point is currently over this view */
	Receiving,
}

/** Drag/receive activity for a registered view, for use in that view */
export interface DraxActivity {
	/** Current drag state of the view: dragged, released, or inactive */
	dragState: DraxDraggedViewState;

	/** Animation offset of drag translation, non-zero when drag state is dragged or released */
	dragOffset: Animated.ValueXY;

	/** If being dragged, the relative offset of where it was grabbed */
	grabOffset?: Position;
	/** If being dragged, the relative offset/dimensions ratio of where it was grabbed */
	grabOffsetRatio?: Position;

	/** Data about the receiver this view is being dragged over, if any */
	draggingOverReceiver?: DraxEventViewData;

	/** Current receiver state of the view: receiving a drag or inactive */
	receiverState: DraxReceiverViewState;

	/** If receiving a drag, the relative offset of where the drag is */
	receiverOffset?: Position;
	/** If receiving a drag, the relative offset/dimensions ratio of where the drag is */
	receiverOffsetRatio?: Position;

	/** Data about the dragged item this view is receiving, if any */
	receivingDrag?: DraxEventViewData;
}

/** Information about a view maintained in the Drax provider state */
export interface DraxViewData {
	/** The view's parent drax view id, if nested */
	parentId?: string;
	/** The view's scroll position ref, if it is a scrollable parent view */
	scrollPositionRef?: RefObject<Position>;
	/** The view's protocol callbacks and data */
	protocol: DraxProtocol;
	/** The view's current drag/receive activity for use in the view */
	activity: DraxActivity;
	/** The view's measurements for bounds checking */
	measurements?: DraxViewMeasurements;
}

/** Information about a view, plus its clipped absolute measurements */
export interface DraxAbsoluteViewData extends DraxViewData {
	absoluteMeasurements: DraxViewMeasurements;
}

/** Combination of a view id and absolute data */
export interface DraxFoundView {
	/** The view's unique identifier */
	id: string;
	/* The view's data */
	data: DraxAbsoluteViewData;
	/** Position, relative to the view, of the touch for which it was found */
	relativePosition: Position;
	/** Position/dimensions ratio, relative to the view, of the touch for which it was found */
	relativePositionRatio: Position;
}

/** Drax provider state for use in reducer; tracks all registered views */
export interface DraxState {
	viewIds: string[];
	viewDataById: {
		[id: string]: DraxViewData;
	};
}

/** Payload for registering a Drax view */
export interface RegisterViewPayload {
	/** The view's unique identifier */
	id: string;
	/** The view's parent drax view id, if nested */
	parentId?: string;
	/** The view's scroll position ref, if it is a scrollable parent view */
	scrollPositionRef?: RefObject<Position>;
}

/** Payload for unregistering a Drax view */
export interface UnregisterViewPayload {
	/** The view's unique identifier */
	id: string;
}

/** Payload for updating the protocol values of a registered view */
export interface UpdateViewProtocolPayload {
	/** The view's unique identifier */
	id: string;
	/** The current protocol values for the view */
	protocol: DraxProtocol;
}

/** Payload for reporting the latest measurements of a view after layout */
export interface MeasureViewPayload {
	/** The view's unique identifier */
	id: string;
	/** The view's measurements */
	measurements: DraxViewMeasurements | undefined;
}

/** Payload used by Drax provider internally for updating activity for a view */
export interface UpdateActivityPayload {
	/** The view's unique identifier */
	id: string;
	/** The activity update */
	activity: Partial<DraxActivity>;
}

/** Payload used by Drax provider internally for updating multiple activities */
export interface UpdateActivitiesPayload {
	/** The activity update payloads */
	activities: UpdateActivityPayload[];
}

/** Tracking information about the current drag, used internally by the Drax provider */
export interface DraxTracking {
	/** Start position of the drag in screen coordinates */
	screenStartPosition: {
		x: number;
		y: number;
	};
	/** Start position of the drag relative to parent view */
	parentStartPosition: {
		x: number;
		y: number;
	}
	/** Information about the dragged view */
	dragged: {
		/** View id of the dragged view */
		id: string;
		/** Animation offset of drag translation */
		dragOffset: Animated.ValueXY;
		/** Post-drag release animation delay in ms */
		dragReleaseAnimationDelay: number;
		/** Post-drag release animation duration in ms */
		dragReleaseAnimationDuration: number;
	};
	/** Information about the current drag receiver, if any */
	receiver?: {
		/** View id of the receiver view */
		id: string;
	};
	/** A list of ids of monitors that the drag is currently over */
	monitorIds: string[];
}

/** Tracking status for reference in views */
export interface DraxTrackingStatus {
	/** Is any view being dragged? */
	dragging: boolean;
	/** Is any view receiving a drag? */
	receiving: boolean;
}

/** Context value used internally by Drax provider */
export interface DraxContextValue {
	getViewData: (id: string) => DraxViewData | undefined;
	getTrackingStatus: () => DraxTrackingStatus;
	registerView: (payload: RegisterViewPayload) => void;
	unregisterView: (payload: UnregisterViewPayload) => void;
	updateViewProtocol: (payload: UpdateViewProtocolPayload) => void;
	measureView: (payload: MeasureViewPayload) => void;
	handleGestureStateChange: (id: string, event: LongPressGestureHandlerStateChangeEvent) => void;
	handleGestureEvent: (id: string, nativeEvent: LongPressGestureHandlerGestureEvent['nativeEvent']) => void;
}

/** Type workaround for lack of Animated.View type, used in DraxView */
export interface AnimatedViewRefType {
	getNode: () => View;
}

/** Optional props that can be passed to a DraxProvider to modify its behavior */
export interface DraxProviderProps {
	debug?: boolean;
}

/** Methods provided by a DraxView when registered externally */
export interface DraxViewRegistration {
	id: string;
	measure: () => void;
}

/** Information about the parent of a nested DraxView, primarily used for scrollable parent views */
export interface DraxViewParent {
	/** Drax view id of the parent */
	id: string;
	/** Ref to node handle of the parent, for measuring relative to */
	nodeHandleRef: RefObject<number | null>;
}

/** Props for a DraxView; combines protocol props and standard view props */
export interface DraxViewProps extends DraxProtocolProps, ViewProps {
	/** If true, translate the view position and elevate while this view is dragged; defaults to true */
	translateDrag?: boolean;

	/** Additional view style applied while this view is not being dragged or released */
	dragInactiveStyle?: ViewProps['style'];

	/** Additional view style applied while this view is being dragged */
	draggingStyle?: ViewProps['style'];

	/** Additional view style applied while this view is being dragged over a receiver */
	draggingWithReceiverStyle?: ViewProps['style'];

	/** Additional view style applied while this view is being dragged NOT over a receiver */
	draggingWithoutReceiverStyle?: ViewProps['style'];

	/** Additional view style applied while this view has just been released from a drag */
	dragReleasedStyle?: ViewProps['style'];

	/** Additional view style applied while this view is not receiving a drag */
	receiverInactiveStyle?: ViewProps['style'];

	/** Additional view style applied while this view is receiving a drag */
	receivingStyle?: ViewProps['style'];

	/** Additional view style applied to this view while any other view is being dragged */
	otherDraggingStyle?: ViewProps['style'];

	/** Additional view style applied to this view while any other view is being dragged over a receiver */
	otherDraggingWithReceiverStyle?: ViewProps['style'];

	/** Additional view style applied to this view while any other view is being dragged NOT over a receiver */
	otherDraggingWithoutReceiverStyle?: ViewProps['style'];

	/** For external registration of this view, to access internal methods, similar to a ref */
	registration?: (registration: DraxViewRegistration | undefined) => void;

	/** Unique drax view id, auto-generated if omitted */
	id?: string;

	/** Parent Drax view, if nesting */
	parent?: DraxViewParent;

	/** The view's scroll position ref, if it is a scrollable parent view */
	scrollPositionRef?: RefObject<Position>;

	/** Time in milliseconds view needs to be pressed before drag starts */
	longPressDelay?: number;
}

export interface DraxListProps<TItem> extends FlatListProperties<TItem> {
	/** Unique drax view id, auto-generated if omitted */
	id?: string;
}

export enum DraxListScrollState {
	BackFast = -2,
	BackSlow = -1,
	Inactive = 0,
	ForwardSlow = 1,
	ForwardFast = 2,
}
