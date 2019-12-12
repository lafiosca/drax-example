import { useCallback, useRef, useState } from 'react';
import { Animated } from 'react-native';
import uuid from 'uuid/v4';

import {
	DraxState,
	DraxInternalState,
	DraxViewState,
	DraxViewDragStatus,
	DraxViewReceiveStatus,
	DraxProtocol,
	RegisterViewPayload,
	UnregisterViewPayload,
	UpdateViewProtocolPayload,
	UpdateViewMeasurementsPayload,
	UpdateViewStatePayload,
	UpdateViewStatesPayload,
	DraxViewData,
	DraxViewMeasurements,
	Position,
	DraxFoundView,
	DraxTrackingStatus,
	StartDragPayload,
} from '../types';
import { clipMeasurements, isPointInside, getRelativePosition } from '../math';
import { defaultDragReleaseAnimationDelay, defaultDragReleaseAnimationDuration } from '../params';

/*
 * The state modifier functions mutate the state parameter, so let's disable
 * the rule "no parameter reassignment" rule for the entire file:
 */

/* eslint-disable no-param-reassign */

/** Create the initial empty protocol data for a newly registered view. */
const createInitialProtocol = (): DraxProtocol => ({
	draggable: false,
	receptive: false,
	monitoring: false,
});

/** Create the initial empty view state data for a newly registered view. */
const createInitialViewState = (): DraxViewState => ({
	dragStatus: DraxViewDragStatus.Inactive,
	dragScreenPosition: new Animated.ValueXY({ x: 0, y: 0 }),
	grabOffset: undefined,
	grabOffsetRatio: undefined,
	draggingOverReceiver: undefined,
	receiveStatus: DraxViewReceiveStatus.Inactive,
	receiveOffset: undefined,
	receiveOffsetRatio: undefined,
	receivingDrag: undefined,
});

/** Create an initial empty Drax internal state. */
const createInitialInternalState = (): DraxInternalState => ({
	viewIds: [],
	viewDataById: {},
	tracking: undefined,
});

/** Create an initial empty Drax state. */
const createInitialState = (): DraxState => ({
	viewStateById: {},
	trackingStatus: {
		dragging: false,
		receiving: false,
	},
});

/** Get data for a registered view by its id. */
const getViewDataInState = (state: DraxInternalState, id: string | undefined): DraxViewData | undefined => (
	(id && state.viewIds.includes(id)) ? state.viewDataById[id] : undefined
);

/** Get absolute screen measurements for a registered view, incorporating parents and clipping. */
const getAbsoluteMeasurementsForViewInState = (
	state: DraxState,
	{ measurements, parentId }: DraxViewData,
): DraxViewMeasurements | undefined => {
	if (!measurements) {
		console.log('Failed to get absolute measurements for view: no measurements');
		return undefined;
	}
	if (!parentId) {
		return measurements;
	}
	const parentViewData = getViewDataInState(state, parentId);
	if (!parentViewData) {
		console.log(`Failed to get absolute measurements for view: no view data for parent id ${parentId}`);
		return undefined;
	}
	const parentMeasurements = getAbsoluteMeasurementsForViewInState(state, parentViewData);
	if (!parentMeasurements) {
		console.log(`Failed to get absolute measurements for view: no absolute measurements for parent id ${parentId}`);
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
};

/** Get data, including absolute measurements, for a registered view by its id. */
const getAbsoluteViewDataInState = (state: DraxState, id: string | undefined) => {
	const viewData = getViewDataInState(state, id);
	if (!viewData) {
		console.log(`No view data for id ${id}`);
		return undefined;
	}
	const absoluteMeasurements = getAbsoluteMeasurementsForViewInState(state, viewData);
	if (!absoluteMeasurements) {
		console.log(`No absolute measurements for id ${id}`);
		return undefined;
	}
	return {
		...viewData,
		absoluteMeasurements,
	};
};

/** Convenience function to return a view's id and absolute data. */
const getAbsoluteViewInState = (state: DraxState, id: string) => ({
	id,
	data: getAbsoluteViewDataInState(state, id),
});

/**
 * Find all monitoring views and the latest receptive view that
 * contain the touch coordinates, excluding the specified view.
 */
const findMonitorsAndReceiverInState = (
	state: DraxState,
	screenPosition: Position,
	excludeViewId: string,
) => {
	const monitors: DraxFoundView[] = [];
	let receiver: DraxFoundView | undefined;

	state.viewIds.forEach((targetId) => {
		if (targetId === excludeViewId) {
			// Don't consider the excluded view.
			return;
		}

		const target = getViewDataInState(state, targetId);

		if (!target) {
			// This should never happen, but just in case.
			return;
		}

		const { receptive, monitoring } = target.protocol;

		if (!receptive && !monitoring) {
			// Only consider receptive or monitoring views.
			return;
		}

		const absoluteMeasurements = getAbsoluteMeasurementsForViewInState(state, target);

		if (!absoluteMeasurements) {
			// Only consider views for which we have absolute measurements.
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
};

/** Get simple status information about the currently tracked drag, if any. */
const getTrackingStatusInState = (state: DraxState): DraxTrackingStatus => ({
	dragging: !!state.tracking?.draggedId,
	receiving: !!state.tracking?.receiverId,
});

/** Get id and data for the currently dragged view, if any. */
const getTrackingDraggedInState = (state: DraxState) => (
	state.tracking && getAbsoluteViewInState(state, state.tracking.draggedId)
);

/** Get id and data for the currently receiving view, if any. */
const getTrackingReceiverInState = (state: DraxState) => (
	state.tracking?.receiverId ? getAbsoluteViewInState(state, state.tracking.receiverId) : undefined
);

/** Get ids for all currently monitoring views. */
const getTrackingMonitorIdsInState = (state: DraxState) => (
	state.tracking?.monitorIds || []
);

/** Get id and data for all currently monitoring views. */
const getTrackingMonitorsInState = (state: DraxState) => (
	state.tracking?.monitorIds.map((id) => getAbsoluteViewInState(state, id)) || []
);

/**
 * Get the screen position of a drag already in progress from touch
 * coordinates within the immediate parent view of the dragged view.
 */
const getDragPositionDataInState = (state: DraxState, parentPosition: Position) => {
	if (!state.tracking) {
		return undefined;
	}
	/*
	 * To determine drag position in screen coordinates, we add:
	 *   screen coordinates of drag start
	 *   + translation offset of drag
	 */
	const { screenStartPosition, parentStartPosition } = state.tracking;
	const translation = {
		x: parentPosition.x - parentStartPosition.x,
		y: parentPosition.y - parentStartPosition.y,
	};
	const screenPosition = {
		x: screenStartPosition.x + translation.x,
		y: screenStartPosition.y + translation.y,
	};
	return { screenPosition, translation };
};

/** Register a Drax view. */
const registerViewInState = (
	state: DraxState,
	{ id, parentId, scrollPositionRef }: RegisterViewPayload,
) => {
	// Make sure not to duplicate registered view id.
	if (state.viewIds.indexOf(id) < 0) {
		state.viewIds.push(id);
	}

	// Maintain any existing view data.
	const existingData = getViewDataInState(state, id);

	state.viewDataById[id] = {
		parentId,
		scrollPositionRef,
		protocol: existingData?.protocol ?? createInitialProtocol(),
		activity: existingData?.activity ?? createInitialActivity(),
		measurements: existingData?.measurements, // Starts undefined.
	};
};

/** Update a view's protocol callbacks/data in the state. */
const updateViewProtocolInState = (
	state: DraxState,
	{ id, protocol }: UpdateViewProtocolPayload,
) => {
	const existingData = getViewDataInState(state, id);
	if (existingData) {
		state.viewDataById[id].protocol = protocol;
	}
};

/** Update a view's measurements in the state. */
const updateViewMeasurementsInState = (
	state: DraxState,
	{ id, measurements }: UpdateViewMeasurementsPayload,
) => {
	const existingData = getViewDataInState(state, id);
	if (existingData) {
		state.viewDataById[id].measurements = measurements;
	}
};

/** Update a view's drag activity in the state. */
const updateViewActivityInState = (
	state: DraxState,
	{ id, activity }: UpdateViewActivityPayload,
) => {
	const existingData = getViewDataInState(state, id);
	if (existingData) {
		state.viewDataById[id].activity = {
			...existingData.activity,
			...activity,
		};
	}
};

/** Update multiple views' drag activities in the state. */
const updateViewActivitiesInState = (
	state: DraxState,
	{ activities }: UpdateViewActivitiesPayload,
) => {
	activities.forEach((activity) => {
		updateViewActivityInState(state, activity);
	});
};

/** Reset the receiver in state's drag tracking, if any. */
const resetReceiverInState = (state: DraxState) => {
	if (!state.tracking) {
		return;
	}
	const { receiverId } = state.tracking;
	if (!receiverId) {
		return;
	}
	console.log('clearing receiver');
	state.tracking.receiverId = undefined;
	updateViewActivityInState(state, {
		id: receiverId,
		activity: {
			receiverState: DraxViewReceiveStatus.Inactive,
			receiverOffset: undefined,
			receiverOffsetRatio: undefined,
			receivingDrag: undefined,
		},
	});
};

/** Reset the state's drag tracking, if any. */
const resetDragInState = (state: DraxState) => {
	if (!state.tracking) {
		return;
	}
	resetReceiverInState(state);
	console.log('clearing drag');
	const { draggedId } = state.tracking;
	state.tracking = undefined;
	const draggedData = getViewDataInState(state, draggedId);
	updateViewActivityInState(state, {
		id: draggedId,
		activity: {
			dragState: DraxViewDragStatus.Released,
			grabOffset: undefined,
			grabOffsetRatio: undefined,
			draggingOverReceiver: undefined,
		},
	});
	if (draggedData) {
		const { dragOffset } = draggedData.activity;
		const {
			dragReleaseAnimationDelay = defaultDragReleaseAnimationDelay,
			dragReleaseAnimationDuration = defaultDragReleaseAnimationDuration,
		} = draggedData.protocol;
		Animated.timing(
			dragOffset,
			{
				toValue: { x: 0, y: 0 },
				delay: dragReleaseAnimationDelay,
				duration: dragReleaseAnimationDuration,
			},
		).start(({ finished }) => {
			if (finished) {
				updateViewActivityInState(state, {
					id: draggedId,
					activity: { dragState: DraxViewDragStatus.Inactive },
				});
			}
		});
	}
};

/** Start tracking a drag. */
const startDragInState = (
	state: DraxState,
	{ screenStartPosition, parentStartPosition, draggedId }: StartDragPayload,
) => {
	resetDragInState(state);
	state.tracking = {
		screenStartPosition,
		parentStartPosition,
		draggedId,
		receiverId: undefined,
		monitorIds: [],
	};
};

/** Set the receiver for a drag. */
const setReceiverIdInState = (
	state: DraxState,
	receiverId: string,
) => {
	if (!state.tracking) {
		return;
	}
	if (state.tracking.receiverId === receiverId) {
		return;
	}
	resetReceiverInState(state);
	state.tracking.receiverId = receiverId;
};

/** Set the monitors for a drag. */
const setMonitorIdsInState = (
	state: DraxState,
	monitorIds: string[],
) => {
	if (!state.tracking) {
		return;
	}
	state.tracking.monitorIds = monitorIds;
};

/** Unregister a Drax view. */
const unregisterViewInState = (
	state: DraxState,
	{ id }: UnregisterViewPayload,
) => {
	const { [id]: removed, ...viewDataById } = state.viewDataById;
	state.viewIds = state.viewIds.filter((thisId) => thisId !== id);
	state.viewDataById = viewDataById;
	if (state.tracking?.draggedId === id) {
		resetDragInState(state);
	} else if (state.tracking?.receiverId === id) {
		resetReceiverInState(state);
	}
};

/** Create a Drax state and wire up all of the methods. */
export const useDraxState = () => {
	/** State for registering views and storing view data. */
	const stateRef = useRef(createInitialState());

	const [, setRenderId] = useState('');

	const rerender = useCallback(
		() => setRenderId(uuid()),
		[setRenderId],
	);

	const getViewData = useCallback(
		(id: string | undefined) => getViewDataInState(stateRef.current, id),
		[],
	);

	const getAbsoluteViewData = useCallback(
		(id: string | undefined) => getAbsoluteViewDataInState(stateRef.current, id),
		[],
	);

	const getTrackingStatus = useCallback(
		() => getTrackingStatusInState(stateRef.current),
		[],
	);

	const getTrackingDragged = useCallback(
		() => getTrackingDraggedInState(stateRef.current),
		[],
	);

	const getTrackingReceiver = useCallback(
		() => getTrackingReceiverInState(stateRef.current),
		[],
	);

	const getTrackingMonitorIds = useCallback(
		() => getTrackingMonitorIdsInState(stateRef.current),
		[],
	);

	const getTrackingMonitors = useCallback(
		() => getTrackingMonitorsInState(stateRef.current),
		[],
	);

	const getDragPositionData = useCallback(
		(parentPosition: Position) => getDragPositionDataInState(stateRef.current, parentPosition),
		[],
	);

	const findMonitorsAndReceiver = useCallback(
		(screenPosition: Position, excludeViewId: string) => (
			findMonitorsAndReceiverInState(stateRef.current, screenPosition, excludeViewId)
		),
		[],
	);

	const registerView = useCallback(
		(payload: RegisterViewPayload) => registerViewInState(stateRef.current, payload),
		[],
	);

	const updateViewProtocol = useCallback(
		(payload: UpdateViewProtocolPayload) => updateViewProtocolInState(stateRef.current, payload),
		[],
	);

	const updateViewMeasurements = useCallback(
		(payload: UpdateViewMeasurementsPayload) => updateViewMeasurementsInState(stateRef.current, payload),
		[],
	);

	const updateViewActivity = useCallback(
		(payload: UpdateViewActivityPayload) => {
			updateViewActivityInState(stateRef.current, payload);
			rerender();
		},
		[rerender],
	);

	const updateViewActivities = useCallback(
		(payload: UpdateViewActivitiesPayload) => {
			updateViewActivitiesInState(stateRef.current, payload);
			rerender();
		},
		[rerender],
	);

	const resetReceiver = useCallback(
		() => {
			resetReceiverInState(stateRef.current);
			rerender();
		},
		[rerender],
	);

	const resetDrag = useCallback(
		() => {
			resetDragInState(stateRef.current);
			rerender();
		},
		[rerender],
	);

	const startDrag = useCallback(
		(payload: StartDragPayload) => {
			startDragInState(stateRef.current, payload);
			rerender();
		},
		[rerender],
	);

	const setReceiverId = useCallback(
		(receiverId: string) => {
			setReceiverIdInState(stateRef.current, receiverId);
			rerender();
		},
		[rerender],
	);

	const setMonitorIds = useCallback(
		(monitorIds: string[]) => {
			setMonitorIdsInState(stateRef.current, monitorIds);
			rerender();
		},
		[rerender],
	);

	const unregisterView = useCallback(
		(payload: UnregisterViewPayload) => unregisterViewInState(stateRef.current, payload),
		[],
	);

	return {
		getViewData,
		getAbsoluteViewData,
		getTrackingStatus,
		getTrackingDragged,
		getTrackingReceiver,
		getTrackingMonitorIds,
		getTrackingMonitors,
		getDragPositionData,
		findMonitorsAndReceiver,
		registerView,
		updateViewProtocol,
		updateViewMeasurements,
		updateViewActivity,
		updateViewActivities,
		resetReceiver,
		resetDrag,
		startDrag,
		setReceiverId,
		setMonitorIds,
		unregisterView,
	};
};
