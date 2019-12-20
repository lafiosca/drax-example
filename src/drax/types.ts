import { RefObject, ReactNode } from 'react';
import {
	ViewProps,
	Animated,
	FlatListProperties,
	ViewStyle,
	StyleProp,
	ScrollViewProperties,
	View,
} from 'react-native';
import {
	LongPressGestureHandlerStateChangeEvent,
	GestureHandlerGestureEvent,
	GestureHandlerGestureEventNativeEvent,
	LongPressGestureHandlerEventExtra,
} from 'react-native-gesture-handler';
import { PayloadActionCreator, ActionType } from 'typesafe-actions';

/** Workaround for incorrect typings. See: https://github.com/kmagiera/react-native-gesture-handler/pull/860/files */
export interface LongPressGestureHandlerGestureEvent extends GestureHandlerGestureEvent {
	nativeEvent: GestureHandlerGestureEventNativeEvent & LongPressGestureHandlerEventExtra;
}

/** Gesture state change event expected by Drax handler */
export type DraxGestureStateChangeEvent = LongPressGestureHandlerStateChangeEvent['nativeEvent'];

/** Gesture event expected by Drax handler */
export type DraxGestureEvent = LongPressGestureHandlerGestureEvent['nativeEvent'];

/** An xy-coordinate position value */
export interface Position {
	/** Position on horizontal x-axis, positive is right */
	x: number;
	/** Position on vertical y-axis, positive is down */
	y: number;
}

/** Dimensions of a view */
export interface ViewDimensions {
	/** Width of view */
	width: number;
	/** Height of view */
	height: number;
}

/** Measurements of a Drax view for bounds checking purposes, relative to Drax parent view or screen */
export interface DraxViewMeasurements extends Position, ViewDimensions {}

/** Predicate for checking if something is a Position */
export const isPosition = (something: any): something is Position => (
	something !== undefined && typeof something.x === 'number' && typeof something.y === 'number'
);

/** Data about a Drax event common to all protocol callbacks */
export interface DraxEventData {
	/** Position of the event in screen coordinates */
	screenPosition: Position;
}

/** Data about a Drax drag event */
export interface DraxDragEventData extends DraxEventData {}

/** Supplemental type for adding a cancelled flag */
interface WithCancelledFlag {
	/** True if the event was cancelled */
	cancelled: boolean;
}

/** Data about a Drax drag end event */
export interface DraxDragEndEventData extends DraxDragEventData, WithCancelledFlag {}

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

/** Data about a Drax receive end event */
export interface DraxReceiveEndEventData extends DraxReceiveEventData, WithCancelledFlag {}

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

/** Data about a Drax monitor drag end event */
export interface DraxMonitorEndEventData extends DraxMonitorEventData, WithCancelledFlag {}

/** Data about a Drax monitor drag-drop event */
export interface DraxMonitorDragDropEventData extends Required<DraxMonitorEventData> {}

/** Preset values for specifying snapback targets without a Position */
export enum DraxSnapbackTargetPreset {
	Default,
	None,
}

/** Target for snapback hover view release animation: none, default, or specified Position */
export type DraxSnapbackTarget = DraxSnapbackTargetPreset | Position;

/**
 * Response type for Drax protocol callbacks involving end of a drag,
 * allowing override of default release snapback behavior.
 */
export type DraxProtocolDragEndResponse = void | DraxSnapbackTarget;

/** Props provided to an internal render function for a hovering copy of a Drax view */
export interface DraxInternalRenderHoverViewProps {
	/** Key of the hover view React node */
	key: string;

	/** Hover position of the view */
	hoverPosition: Animated.ValueXY;

	/** State for the view */
	viewState: DraxViewState;

	/** Drax tracking status */
	trackingStatus: DraxTrackingStatus;

	/** Dimensions for the view */
	dimensions: ViewDimensions;
}

/** Props provided to a render function for a Drax view */
export interface DraxRenderContentProps {
	/** State for the view, if available */
	viewState?: DraxViewState;

	/** Drax tracking status */
	trackingStatus: DraxTrackingStatus;

	/** Is this a hovering copy of the view? */
	hover: boolean;

	/** React children of the DraxView */
	children: ReactNode;

	/** Dimensions for the view, if available */
	dimensions?: ViewDimensions;
}

/** Props provided to a render function for a hovering copy of a Drax view, compatible with DraxRenderContentProps */
export interface DraxRenderHoverContentProps extends Required<DraxRenderContentProps> {}

/** Callback protocol for communicating Drax events to views */
export interface DraxProtocol {
	/** Called in the dragged view when a drag action begins */
	onDragStart?: (data: DraxDragEventData) => void;

	/** Called in the dragged view repeatedly while dragged, not over any receiver */
	onDrag?: (data: DraxDragEventData) => void;

	/** Called in the dragged view when initially dragged over a new receiver */
	onDragEnter?: (data: DraxDragWithReceiverEventData) => void;

	/** Called in the dragged view repeatedly while dragged over a receiver */
	onDragOver?: (data: DraxDragWithReceiverEventData) => void;

	/** Called in the dragged view when dragged off of a receiver */
	onDragExit?: (data: DraxDragWithReceiverEventData) => void;

	/** Called in the dragged view when drag ends not over any receiver or is cancelled */
	onDragEnd?: (data: DraxDragEndEventData) => DraxProtocolDragEndResponse;

	/** Called in the dragged view when drag ends over a receiver */
	onDragDrop?: (data: DraxDragWithReceiverEventData) => DraxProtocolDragEndResponse;

	/** Called in the receiver view each time an item is initially dragged over it */
	onReceiveDragEnter?: (data: DraxReceiveEventData) => void;

	/** Called in the receiver view repeatedly while an item is dragged over it */
	onReceiveDragOver?: (data: DraxReceiveEventData) => void;

	/** Called in the receiver view when item is dragged off of it or drag is cancelled */
	onReceiveDragExit?: (data: DraxReceiveEndEventData) => void;

	/** Called in the receiver view when drag ends over it */
	onReceiveDragDrop?: (data: DraxReceiveEventData) => DraxProtocolDragEndResponse;

	/** Called in the monitor view when a drag action begins over it */
	onMonitorDragStart?: (data: DraxMonitorEventData) => void;

	/** Called in the monitor view each time an item is initially dragged over it */
	onMonitorDragEnter?: (data: DraxMonitorEventData) => void;

	/** Called in the monitor view repeatedly while an item is dragged over it */
	onMonitorDragOver?: (data: DraxMonitorEventData) => void;

	/** Called in the monitor view when item is dragged off of it */
	onMonitorDragExit?: (data: DraxMonitorEventData) => void;

	/** Called in the monitor view when drag ends over it while not over any receiver or drag is cancelled */
	onMonitorDragEnd?: (data: DraxMonitorEndEventData) => DraxProtocolDragEndResponse;

	/** Called in the monitor view when drag ends over it while over a receiver */
	onMonitorDragDrop?: (data: DraxMonitorDragDropEventData) => DraxProtocolDragEndResponse;

	/** Whether or not to animate hover view snapback after drag release, defaults to true */
	animateSnapback?: boolean;

	/** Delay in ms before hover view snapback begins after drag is released */
	snapbackDelay?: number;

	/** Duration in ms for hover view snapback to complete */
	snapbackDuration?: number;

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

	/** Function used internally for rendering hovering copy of view when dragged/released */
	internalRenderHoverView?: (props: DraxInternalRenderHoverViewProps) => ReactNode;
}

/** Props for components implementing the protocol */
export interface DraxProtocolProps extends Partial<Omit<DraxProtocol, 'internalRenderHoverView'>> {
	/** Convenience prop to provide one value for both `dragPayload` and `receiverPayload` */
	payload?: any;
}

/** The states a dragged view can be in */
export enum DraxViewDragStatus {
	/** View is not being dragged */
	Inactive,
	/** View is being actively dragged; an active drag touch began in this view */
	Dragging,
	/** View has been released but has not yet snapped back to inactive */
	Released,
}

/** The states a receiver view can be in */
export enum DraxViewReceiveStatus {
	/** View is not receiving a drag */
	Inactive,
	/** View is receiving a drag; an active drag touch point is currently over this view */
	Receiving,
}

/** Information about a view, used internally by the Drax provider */
export interface DraxViewData {
	/** The view's Drax parent view id, if nested */
	parentId?: string;
	/** The view's scroll position ref, if it is a scrollable parent view */
	scrollPositionRef?: RefObject<Position>;
	/** The view's protocol callbacks and data */
	protocol: DraxProtocol;
	/** The view's measurements for bounds checking */
	measurements?: DraxViewMeasurements;
}

/** Information about a view, plus its clipped absolute measurements */
export interface DraxAbsoluteViewData extends
	Omit<DraxViewData, 'measurements'>,
	Required<Pick<DraxViewData, 'measurements'>> {
	/** Absolute measurements for view */
	absoluteMeasurements: DraxViewMeasurements;
}

/** Wrapper of id and absolute data for a view */
export interface DraxAbsoluteViewEntry {
	/** The view's unique identifier */
	id: string;
	/* The view's absolute data */
	data: DraxAbsoluteViewData;
}

/** Wrapper of id and absolute data for a view found when checking a position */
export interface DraxFoundAbsoluteViewEntry extends DraxAbsoluteViewEntry {
	/** Position, relative to the view, of the touch for which it was found */
	relativePosition: Position;
	/** Position/dimensions ratio, relative to the view, of the touch for which it was found */
	relativePositionRatio: Position;
}

/** Tracking information about the current receiver, used internally by the Drax provider */
export interface DraxTrackingReceiver {
	/** View id of the current receiver */
	receiverId: string;
	/** The relative offset the drag point in the receiving view */
	receiveOffset: Animated.ValueXY;
	/** The relative offset/dimensions ratio of the drag point in the receiving view */
	receiveOffsetRatio: Animated.ValueXY;
}

/** Tracking information about the current drag, used internally by the Drax provider */
export interface DraxTrackingDrag {
	/** View id of the dragged view */
	draggedId: string;
	/** Start position of the drag in screen coordinates */
	screenStartPosition: Position;
	/** Start position of the drag relative to dragged view's immediate parent */
	parentStartPosition: Position;
	/** The position in screen coordinates of the drag point */
	dragScreenPosition: Animated.ValueXY;
	/** The relative offset of the drag point from the view */
	dragOffset: Animated.ValueXY;
	/** The relative offset within the dragged view of where it was grabbed */
	grabOffset: Position;
	/** The position in screen coordinates of the dragged hover view (dragScreenPosition - grabOffset) */
	hoverPosition: Animated.ValueXY;
	/** Tracking information about the current drag receiver, if any */
	receiver?: DraxTrackingReceiver;
	/** View ids of monitors that the drag is currently over */
	monitorIds: string[];
}

/** Tracking information about a view that was released and is snapping back */
export interface DraxTrackingRelease {
	/** View id of the released view */
	viewId: string;
	/** The position in screen coordinates of the released hover view */
	hoverPosition: Animated.ValueXY;
}

/** Tracking status for reference in views */
export interface DraxTrackingStatus {
	/** Is any view being dragged? */
	dragging: boolean;
	/** Is any view receiving a drag? */
	receiving: boolean;
}

/** Render-related state for a registered view */
export interface DraxViewState {
	/** Current drag status of the view: Dragged, Released, or Inactive */
	dragStatus: DraxViewDragStatus;

	/** If being dragged or released, the position in screen coordinates of the drag point */
	dragScreenPosition?: Animated.ValueXY;
	/** If being dragged or released, the relative offset of the drag point from the view */
	dragOffset?: Animated.ValueXY;

	/** If being dragged, the relative offset of where the view was grabbed */
	grabOffset?: Position;
	/** If being dragged, the relative offset/dimensions ratio of where the view was grabbed */
	grabOffsetRatio?: Position;

	/** The position in screen coordinates of the dragged hover view (dragScreenPosition - grabOffset) */
	hoverPosition?: Animated.ValueXY;

	/** Data about the receiver this view is being dragged over, if any */
	draggingOverReceiver?: DraxEventViewData;

	/** Current receive status of the view: Receiving or Inactive */
	receiveStatus: DraxViewReceiveStatus;

	/** If receiving a drag, the relative offset the drag point in the view */
	receiveOffset?: Animated.ValueXY;
	/** If receiving a drag, the relative offset/dimensions ratio of the drag point in the view */
	receiveOffsetRatio?: Animated.ValueXY;

	/** Data about the dragged item this view is receiving, if any */
	receivingDrag?: DraxEventViewData;
}

/** Drax provider render state; maintains render-related data */
export interface DraxState {
	/** Render-related state for all registered views, keyed by their unique identifiers */
	viewStateById: {
		/** Render-related state for a registered view, keyed by its unique identifier */
		[id: string]: DraxViewState;
	}
	/** Tracking status indicating whether anything is being dragged/received */
	trackingStatus: DraxTrackingStatus;
}

/** Payload to start tracking a drag */
export interface StartDragPayload {
	/** Absolute screen position of where the drag started */
	screenStartPosition: Position;
	/** Position relative to the dragged view's immediate parent where the drag started */
	parentStartPosition: Position;
	/** The dragged view's unique identifier */
	draggedId: string;
	/** The relative offset within the view of where it was grabbed */
	grabOffset: Position;
	/** The relative offset/dimensions ratio within the view of where it was grabbed */
	grabOffsetRatio: Position;
}

/** Payload for registering a Drax view */
export interface RegisterViewPayload {
	/** The view's unique identifier */
	id: string;
	/** The view's Drax parent view id, if nested */
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
export interface UpdateViewMeasurementsPayload {
	/** The view's unique identifier */
	id: string;
	/** The view's measurements */
	measurements: DraxViewMeasurements | undefined;
}

/** Payload used by Drax provider internally for creating a view's state */
export interface CreateViewStatePayload {
	/** The view's unique identifier */
	id: string;
}

/** Payload used by Drax provider internally for updating a view's state */
export interface UpdateViewStatePayload {
	/** The view's unique identifier */
	id: string;
	/** The view state update */
	viewStateUpdate: Partial<DraxViewState>;
}

/** Payload used by Drax provider internally for deleting a view's state */
export interface DeleteViewStatePayload {
	/** The view's unique identifier */
	id: string;
}

/** Payload used by Drax provider internally for updating tracking status */
export interface UpdateTrackingStatusPayload extends Partial<DraxTrackingStatus> {}

/** Collection of Drax state action creators */
export interface DraxStateActionCreators {
	createViewState: PayloadActionCreator<'createViewState', CreateViewStatePayload>,
	updateViewState: PayloadActionCreator<'updateViewState', UpdateViewStatePayload>,
	deleteViewState: PayloadActionCreator<'deleteViewState', DeleteViewStatePayload>,
	updateTrackingStatus: PayloadActionCreator<'updateTrackingStatus', UpdateTrackingStatusPayload>,
}

/** Dispatchable Drax state action */
export type DraxStateAction = ActionType<DraxStateActionCreators>;

/** Dispatcher of Drax state actions */
export type DraxStateDispatch = (action: DraxStateAction) => void;

/** Drax provider internal registry; maintains view data and tracks drags, updating state */
export interface DraxRegistry {
	/** A list of the unique identifiers of the registered views, in order of registration */
	viewIds: string[];
	/** Data about all registered views, keyed by their unique identifiers */
	viewDataById: {
		/** Data about a registered view, keyed by its unique identifier */
		[id: string]: DraxViewData;
	};
	/** Information about the current drag, if any */
	drag?: DraxTrackingDrag;
	/** A list of the unique identifiers of tracked drag releases, in order of release */
	releaseIds: string[];
	/** Released drags that are snapping back, keyed by unique release identifier */
	releaseById: {
		[releaseId: string]: DraxTrackingRelease;
	}
	/** Drax state dispatch function */
	stateDispatch: DraxStateDispatch;
}

/** Context value used internally by Drax provider */
export interface DraxContextValue {
	/** Get a Drax view state by view id, if it exists */
	getViewState: (id: string) => DraxViewState | undefined;

	/** Get current Drax tracking status */
	getTrackingStatus: () => DraxTrackingStatus;

	/** Register a Drax view */
	registerView: (payload: RegisterViewPayload) => void;

	/** Unregister a Drax view */
	unregisterView: (payload: UnregisterViewPayload) => void;

	/** Update protocol for a registered Drax view */
	updateViewProtocol: (payload: UpdateViewProtocolPayload) => void;

	/** Update view measurements for a registered Drax view */
	updateViewMeasurements: (payload: UpdateViewMeasurementsPayload) => void;

	/** Handle gesture state change for a registered Drax view */
	handleGestureStateChange: (id: string, event: DraxGestureStateChangeEvent) => void;

	/** Handle gesture event for a registered Drax view */
	handleGestureEvent: (id: string, event: DraxGestureEvent) => void;

	/** Drax parent view for all views under this context, when nesting */
	parent?: DraxParentView;
}

/** Optional props that can be passed to a DraxProvider to modify its behavior */
export interface DraxProviderProps {
	debug?: boolean;
}

/** Props that are passed to a DraxSubprovider, used internally for nesting views */
export interface DraxSubproviderProps {
	/** Drax parent view for all views under this subcontext, when nesting */
	parent: DraxParentView;
}

/** Methods provided by a DraxView when registered externally */
export interface DraxViewRegistration {
	id: string;
	measure: (measurementHandler?: DraxViewMeasurementHandler) => void;
}

/** Information about the parent of a nested DraxView, primarily used for scrollable parent views */
export interface DraxParentView {
	/** Drax view id of the parent */
	id: string;
	/** Ref to node handle of the parent, for measuring relative to */
	nodeHandleRef: RefObject<number | null>;
}

/** Type augmentation to allow an animated value */
type MaybeAnimated<T> = T | Animated.Value;

/** Scalar type that can be replaced by an animated value */
type AnimatedScalar = string | number;

/** Type augmentation to allow a style to support animated values */
export type AnimatedStyle<T> = {
	[Key in keyof T]: T[Key] extends AnimatedScalar
		? MaybeAnimated<T[Key]>
		: T[Key] extends Array<infer U>
			? Array<AnimatedStyle<U>>
			: AnimatedStyle<T[Key]>
};

/** Style for an Animated.View */
export type AnimatedViewStyle = AnimatedStyle<ViewStyle>;

/** Style prop for an Animated.View */
export type AnimatedViewStyleProp = StyleProp<AnimatedViewStyle>;

/** Helper type for coercing the output of Animated.ValueXY.getTranslateTransform() */
export type AnimatedTransform = AnimatedStyle<ViewStyle['transform']>;

/** Type workaround for lack of Animated.View type, used in DraxView */
export interface AnimatedViewRefType {
	getNode: () => View;
}

/** Function that receives a Drax view measurement */
export interface DraxViewMeasurementHandler {
	(measurements: DraxViewMeasurements | undefined): void
}

/** Props for a DraxView; combines protocol props and standard view props */
export interface DraxViewProps extends DraxProtocolProps, Omit<ViewProps, 'style'> {
	/** Custom style prop to allow animated values */
	style?: AnimatedViewStyleProp;

	/** Additional view style applied while this view is not being dragged or released */
	dragInactiveStyle?: AnimatedViewStyleProp;

	/** Additional view style applied while this view is being dragged */
	draggingStyle?: AnimatedViewStyleProp;

	/** Additional view style applied while this view is being dragged over a receiver */
	draggingWithReceiverStyle?: AnimatedViewStyleProp;

	/** Additional view style applied while this view is being dragged NOT over a receiver */
	draggingWithoutReceiverStyle?: AnimatedViewStyleProp;

	/** Additional view style applied while this view has just been released from a drag */
	dragReleasedStyle?: AnimatedViewStyleProp;

	/** Additional view style applied to the hovering copy of this view during drag/release */
	hoverStyle?: AnimatedViewStyleProp;

	/** Additional view style applied to the hovering copy of this view while dragging */
	hoverDraggingStyle?: AnimatedViewStyleProp;

	/** Additional view style applied to the hovering copy of this view while dragging over a receiver */
	hoverDraggingWithReceiverStyle?: AnimatedViewStyleProp;

	/** Additional view style applied to the hovering copy of this view while dragging NOT over a receiver */
	hoverDraggingWithoutReceiverStyle?: AnimatedViewStyleProp;

	/** Additional view style applied to the hovering copy of this view when just released */
	hoverDragReleasedStyle?: AnimatedViewStyleProp;

	/** Additional view style applied while this view is not receiving a drag */
	receiverInactiveStyle?: AnimatedViewStyleProp;

	/** Additional view style applied while this view is receiving a drag */
	receivingStyle?: AnimatedViewStyleProp;

	/** Additional view style applied to this view while any other view is being dragged */
	otherDraggingStyle?: AnimatedViewStyleProp;

	/** Additional view style applied to this view while any other view is being dragged over a receiver */
	otherDraggingWithReceiverStyle?: AnimatedViewStyleProp;

	/** Additional view style applied to this view while any other view is being dragged NOT over a receiver */
	otherDraggingWithoutReceiverStyle?: AnimatedViewStyleProp;

	/** Custom render function for content of this view */
	renderContent?: (props: DraxRenderContentProps, context: any) => ReactNode;

	/** Custom render function for content of hovering copy of this view, defaults to renderContent */
	renderHoverContent?: (props: DraxRenderHoverContentProps, context: any) => ReactNode;

	/** If true, do not render hover view copies for this view when dragging */
	noHover?: boolean;

	/** For external registration of this view, to access internal methods, similar to a ref */
	registration?: (registration: DraxViewRegistration | undefined) => void;

	/** For receiving view measurements externally */
	onMeasure?: DraxViewMeasurementHandler;

	/** Unique Drax view id, auto-generated if omitted */
	id?: string;

	/** Drax parent view, if nesting */
	parent?: DraxParentView;

	/** If true, treat this view as a Drax parent view for nested children */
	isParent?: boolean;

	/** The view's scroll position ref, if it is a scrollable parent view */
	scrollPositionRef?: RefObject<Position>;

	/** Time in milliseconds view needs to be pressed before drag starts */
	longPressDelay?: number;
}

/** Auto-scroll direction used internally by DraxScrollView and DraxList */
export enum AutoScrollDirection {
	/** Auto-scrolling back toward the beginning of list */
	Back = -1,
	/** Not auto-scrolling */
	None = 0,
	/** Auto-scrolling forward toward the end of the list */
	Forward = 1,
}

/** Auto-scroll state used internally by DraxScrollView */
export interface AutoScrollState {
	/* Auto-scroll direction for the x-axis */
	x: AutoScrollDirection;
	/* Auto-scroll direction for the y-axis */
	y: AutoScrollDirection;
}

/** Props for auto-scroll options, used by DraxScrollView and DraxList */
export interface DraxAutoScrollProps {
	/* How often auto-scroll should jump, in milliseconds */
	autoScrollIntervalLength?: number;
	/* How far auto-scroll should jump each time, as a fraction of container dimension */
	autoScrollJumpRatio?: number;
	/* The maximum threshold for a drag position to trigger auto-scroll back, as a fraction of container dimension */
	autoScrollBackThreshold?: number;
	/* The minimum threshold for a drag position to trigger auto-scroll forward, as a fraction of container dimension */
	autoScrollForwardThreshold?: number;
}

/** Props for a DraxScrollView; extends standard ScrollView props */
export interface DraxScrollViewProps extends ScrollViewProperties, DraxAutoScrollProps {
	/** Unique drax view id, auto-generated if omitted */
	id?: string;
}

/** Event data for when an item is moved within a DraxList */
export interface DraxListOnListItemMovedEventData<TItem> {
	/* The item that was moved */
	fromItem: TItem;
	/* The list index of the item that was moved */
	fromIndex: number;
	/* The item it was moved onto */
	toItem: TItem;
	/* The list index of the item it was moved onto */
	toIndex: number;
}

/** Props for a DraxList; extends standard FlatList props */
export interface DraxListProps<TItem> extends FlatListProperties<TItem>, DraxAutoScrollProps {
	/** Unique drax view id, auto-generated if omitted */
	id?: string;

	/** Can the list be reordered by dragging items? */
	reorderable?: boolean;

	/** Callback handler for when a list item is moved, if reorderable */
	onListItemMoved?: (eventData: DraxListOnListItemMovedEventData<TItem>) => void;
}
