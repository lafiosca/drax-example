import { useCallback, useRef, useMemo } from 'react';

import { actions, DraxAction, DraxDispatch } from './actions';
import {
	DraxRegistry,
	DraxViewDragStatus,
	DraxViewReceiveStatus,
	DraxProtocol,
	RegisterViewPayload,
	UnregisterViewPayload,
	UpdateViewProtocolPayload,
	UpdateViewMeasurementsPayload,
	DraxViewData,
	DraxViewMeasurements,
	Position,
	DraxFoundAbsoluteViewEntry,
	StartDragPayload,
	DraxAbsoluteViewEntry,
	DraxAbsoluteViewData,
} from '../types';
import {
	clipMeasurements,
	isPointInside,
	getRelativePosition,
} from '../math';

/*
 * The registry functions mutate their registry parameter, so let's
 * disable the "no parameter reassignment" rule for the entire file:
 */

/* eslint-disable no-param-reassign */

/** Create an initial empty Drax registry. */
const createInitialRegistry = (): DraxRegistry => ({
	viewIds: [],
	viewDataById: {},
	tracking: undefined,
});

/** Create the initial empty protocol data for a newly registered view. */
const createInitialProtocol = (): DraxProtocol => ({
	draggable: false,
	receptive: false,
	monitoring: false,
});

/** Get data for a registered view by its id. */
const getViewDataFromRegistry = (registry: DraxRegistry, id: string | undefined): DraxViewData | undefined => (
	(id && registry.viewIds.includes(id)) ? registry.viewDataById[id] : undefined
);

/** Get absolute screen measurements for a registered view, incorporating parents and clipping. */
const getAbsoluteMeasurementsForViewFromRegistry = (
	registry: DraxRegistry,
	{ measurements, parentId }: DraxViewData,
): DraxViewMeasurements | undefined => {
	if (!measurements) {
		console.log('Failed to get absolute measurements for view: no measurements');
		return undefined;
	}
	if (!parentId) {
		return measurements;
	}
	const parentViewData = getViewDataFromRegistry(registry, parentId);
	if (!parentViewData) {
		console.log(`Failed to get absolute measurements for view: no view data for parent id ${parentId}`);
		return undefined;
	}
	const parentMeasurements = getAbsoluteMeasurementsForViewFromRegistry(registry, parentViewData);
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
const getAbsoluteViewDataFromRegistry = (
	registry: DraxRegistry,
	id: string | undefined,
): DraxAbsoluteViewData | undefined => {
	const viewData = getViewDataFromRegistry(registry, id);
	if (!viewData) {
		console.log(`No view data for id ${id}`);
		return undefined;
	}
	const absoluteMeasurements = getAbsoluteMeasurementsForViewFromRegistry(registry, viewData);
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
const getAbsoluteViewEntryFromRegistry = (
	registry: DraxRegistry,
	id: string | undefined,
): DraxAbsoluteViewEntry | undefined => {
	if (id === undefined) {
		return undefined;
	}
	const data = getAbsoluteViewDataFromRegistry(registry, id);
	return data && { id, data };
};

/**
 * Find all monitoring views and the latest receptive view that
 * contain the touch coordinates, excluding the specified view.
 */
const findMonitorsAndReceiverInRegistry = (
	registry: DraxRegistry,
	screenPosition: Position,
	excludeViewId: string,
) => {
	const monitors: DraxFoundAbsoluteViewEntry[] = [];
	let receiver: DraxFoundAbsoluteViewEntry | undefined;

	registry.viewIds.forEach((targetId) => {
		if (targetId === excludeViewId) {
			// Don't consider the excluded view.
			return;
		}

		const target = getViewDataFromRegistry(registry, targetId);

		if (!target) {
			// This should never happen, but just in case.
			return;
		}

		const { receptive, monitoring } = target.protocol;

		if (!receptive && !monitoring) {
			// Only consider receptive or monitoring views.
			return;
		}

		const absoluteMeasurements = getAbsoluteMeasurementsForViewFromRegistry(registry, target);

		if (!absoluteMeasurements) {
			// Only consider views for which we have absolute measurements.
			return;
		}

		if (isPointInside(screenPosition, absoluteMeasurements)) {
			// Drag point is within this target.
			const foundView: DraxFoundAbsoluteViewEntry = {
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

/** Get id and data for the currently dragged view, if any. */
const getTrackingDraggedFromRegistry = (registry: DraxRegistry) => (
	registry.tracking && getAbsoluteViewEntryFromRegistry(registry, registry.tracking.draggedId)
);

/** Get id and data for the currently receiving view, if any. */
const getTrackingReceiverFromRegistry = (registry: DraxRegistry) => (
	registry.tracking?.receiverId
		? getAbsoluteViewEntryFromRegistry(registry, registry.tracking.receiverId)
		: undefined
);

/** Get ids for all currently monitoring views. */
const getTrackingMonitorIdsFromRegistry = (registry: DraxRegistry) => (
	registry.tracking?.monitorIds || []
);

/** Get id and data for all currently monitoring views. */
const getTrackingMonitorsFromRegistry = (registry: DraxRegistry) => (
	registry.tracking?.monitorIds
		.map((id) => getAbsoluteViewEntryFromRegistry(registry, id))
		.filter((value): value is DraxAbsoluteViewEntry => !!value)
		|| []
);

/**
 * Get the screen position of a drag already in progress from touch
 * coordinates within the immediate parent view of the dragged view.
 */
const getDragPositionDataFromRegistry = (registry: DraxRegistry, parentPosition: Position) => {
	if (!registry.tracking) {
		return undefined;
	}
	/*
	 * To determine drag position in screen coordinates, we add:
	 *   screen coordinates of drag start
	 *   + translation offset of drag
	 */
	const { screenStartPosition, parentStartPosition } = registry.tracking;
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
const registerViewInRegistry = (
	registry: DraxRegistry,
	{ id, parentId, scrollPositionRef }: RegisterViewPayload,
): DraxAction[] => {
	// Make sure not to duplicate registered view id.
	if (registry.viewIds.indexOf(id) < 0) {
		registry.viewIds.push(id);
	}

	// Maintain any existing view data.
	const existingData = getViewDataFromRegistry(registry, id);

	registry.viewDataById[id] = {
		parentId,
		scrollPositionRef,
		protocol: existingData?.protocol ?? createInitialProtocol(),
		measurements: existingData?.measurements, // Starts undefined.
	};

	return [actions.createViewState({ id })];
};

/** Update a view's protocol callbacks/data. */
const updateViewProtocolInRegistry = (
	registry: DraxRegistry,
	{ id, protocol }: UpdateViewProtocolPayload,
) => {
	const existingData = getViewDataFromRegistry(registry, id);
	if (existingData) {
		registry.viewDataById[id].protocol = protocol;
	}
};

/** Update a view's measurements. */
const updateViewMeasurementsInRegistry = (
	registry: DraxRegistry,
	{ id, measurements }: UpdateViewMeasurementsPayload,
) => {
	const existingData = getViewDataFromRegistry(registry, id);
	if (existingData) {
		registry.viewDataById[id].measurements = measurements;
	}
};

/** Reset the receiver in drag tracking, if any. */
const resetReceiverInRegistry = (registry: DraxRegistry): DraxAction[] => {
	if (!registry.tracking) {
		return [];
	}
	const { draggedId, receiverId } = registry.tracking;
	if (!receiverId) {
		console.log('no receiver to clear');
		return [];
	}
	console.log('clearing receiver');
	registry.tracking.receiverId = undefined;
	return [
		actions.updateTrackingStatus({ receiving: false }),
		actions.updateViewState({
			id: draggedId,
			viewStateUpdate: {
				draggingOverReceiver: undefined,
			},
		}),
		actions.updateViewState({
			id: receiverId,
			viewStateUpdate: {
				receiveStatus: DraxViewReceiveStatus.Inactive,
				receiveOffset: undefined,
				receiveOffsetRatio: undefined,
				receivingDrag: undefined,
			},
		}),
	];
};

/** Reset drag tracking, if any. */
const resetDragInRegistry = (registry: DraxRegistry): DraxAction[] => {
	if (!registry.tracking) {
		return [];
	}
	const reactions = resetReceiverInRegistry(registry);
	console.log('clearing drag');
	const { draggedId } = registry.tracking;
	registry.tracking = undefined;
	reactions.push(actions.updateTrackingStatus({ dragging: false }));
	reactions.push(actions.updateViewState({
		id: draggedId,
		viewStateUpdate: {
			dragStatus: DraxViewDragStatus.Inactive,
			grabOffset: undefined,
			grabOffsetRatio: undefined,
		},
	}));
	// TODO: come back to this to fix releases
	// const draggedData = getViewDataFromRegistry(registry, draggedId);
	// if (draggedData) {
	// 	const { dragOffset } = draggedData.activity;
	// 	const {
	// 		dragReleaseAnimationDelay = defaultDragReleaseAnimationDelay,
	// 		dragReleaseAnimationDuration = defaultDragReleaseAnimationDuration,
	// 	} = draggedData.protocol;
	// 	Animated.timing(
	// 		dragOffset,
	// 		{
	// 			toValue: { x: 0, y: 0 },
	// 			delay: dragReleaseAnimationDelay,
	// 			duration: dragReleaseAnimationDuration,
	// 		},
	// 	).start(({ finished }) => {
	// 		if (finished) {
	// 			updateViewActivityInState(state, {
	// 				id: draggedId,
	// 				activity: { dragState: DraxViewDragStatus.Inactive },
	// 			});
	// 		}
	// 	});
	// }
	return reactions;
};

/** Start tracking a drag. */
const startDragInRegistry = (
	registry: DraxRegistry,
	{
		screenStartPosition,
		parentStartPosition,
		draggedId,
		grabOffset,
		grabOffsetRatio,
	}: StartDragPayload,
): DraxAction[] => {
	const reactions = resetDragInRegistry(registry);
	registry.tracking = {
		screenStartPosition,
		parentStartPosition,
		draggedId,
		receiverId: undefined,
		monitorIds: [],
	};
	reactions.push(actions.updateTrackingStatus({ dragging: true }));
	reactions.push(actions.updateViewState({
		id: draggedId,
		viewStateUpdate: {
			dragStatus: DraxViewDragStatus.Dragging,
			grabOffset,
			grabOffsetRatio,
		},
	}));
	return reactions;
};

/** Update receiver for a drag. */
const updateReceiverInRegistry = (
	registry: DraxRegistry,
	receiver: DraxFoundAbsoluteViewEntry,
	dragged: DraxAbsoluteViewEntry,
): DraxAction[] => {
	if (!registry.tracking) {
		return [];
	}
	const {
		relativePosition,
		relativePositionRatio,
		id: receiverId,
		data: receiverData,
	} = receiver;
	const {
		parentId: receiverParentId,
		protocol: { receiverPayload },
	} = receiverData;
	const {
		id: draggedId,
		data: draggedData,
	} = dragged;
	const {
		parentId: draggedParentId,
		protocol: { dragPayload },
	} = draggedData;
	const { receiverId: oldReceiverId } = registry.tracking;
	const reactions: DraxAction[] = [];
	if (oldReceiverId !== undefined && oldReceiverId !== receiverId) {
		reactions.push(...resetReceiverInRegistry(registry));
	}
	registry.tracking.receiverId = receiverId;
	reactions.push(actions.updateTrackingStatus({ receiving: true }));
	reactions.push(actions.updateViewState({
		id: receiverId,
		viewStateUpdate: {
			receiveStatus: DraxViewReceiveStatus.Receiving,
			receiveOffset: relativePosition,
			receiveOffsetRatio: relativePositionRatio,
			receivingDrag: {
				id: draggedId,
				parentId: draggedParentId,
				payload: dragPayload,
			},
		},
	}));
	reactions.push(actions.updateViewState({
		id: draggedId,
		viewStateUpdate: {
			draggingOverReceiver: {
				id: receiverId,
				parentId: receiverParentId,
				payload: receiverPayload,
			},
		},
	}));
	return reactions;
};

/** Set the monitors for a drag. */
const setMonitorIdsInRegistry = (registry: DraxRegistry, monitorIds: string[]): DraxAction[] => {
	if (registry.tracking) {
		registry.tracking.monitorIds = monitorIds;
	}
	return [];
};

/** Unregister a Drax view. */
const unregisterViewInRegistry = (
	registry: DraxRegistry,
	{ id }: UnregisterViewPayload,
): DraxAction[] => {
	const reactions: DraxAction[] = [];
	const { [id]: removed, ...viewDataById } = registry.viewDataById;
	registry.viewIds = registry.viewIds.filter((thisId) => thisId !== id);
	registry.viewDataById = viewDataById;
	if (registry.tracking?.draggedId === id) {
		reactions.push(...resetDragInRegistry(registry));
	} else if (registry.tracking?.receiverId === id) {
		reactions.push(...resetReceiverInRegistry(registry));
	}
	reactions.push(actions.deleteViewState({ id }));
	return reactions;
};

/** Create a Drax registry and wire up all of the methods. */
export const useDraxRegistry = (dispatch: DraxDispatch) => {
	/** Registry for tracking views and drags. */
	const registryRef = useRef(createInitialRegistry());

	/** Dispatch multiple Drax actions at once (i.e., view state and tracking status updates). */
	const multiDispatch = useCallback(
		(actions: DraxAction[]) => {
			actions.forEach((action) => {
				console.log(`Dispatching: ${JSON.stringify(action, null, 2)}`);
				dispatch(action);
			});
		},
		[dispatch],
	);

	/**
	 *
	 * Getters/finders, with no state reactions.
	 *
	 */

	/** Get data for a registered view by its id. */
	const getViewData = useCallback(
		(id: string | undefined) => getViewDataFromRegistry(registryRef.current, id),
		[],
	);

	/** Get data, including absolute measurements, for a registered view by its id. */
	const getAbsoluteViewData = useCallback(
		(id: string | undefined) => getAbsoluteViewDataFromRegistry(registryRef.current, id),
		[],
	);

	/** Get id and data for the currently dragged view, if any. */
	const getTrackingDragged = useCallback(
		() => getTrackingDraggedFromRegistry(registryRef.current),
		[],
	);

	/** Get id and data for the currently receiving view, if any. */
	const getTrackingReceiver = useCallback(
		() => getTrackingReceiverFromRegistry(registryRef.current),
		[],
	);

	/** Get ids for all currently monitoring views. */
	const getTrackingMonitorIds = useCallback(
		() => getTrackingMonitorIdsFromRegistry(registryRef.current),
		[],
	);

	/** Get id and data for all currently monitoring views. */
	const getTrackingMonitors = useCallback(
		() => getTrackingMonitorsFromRegistry(registryRef.current),
		[],
	);

	/**
	 * Get the screen position of a drag already in progress from touch
	 * coordinates within the immediate parent view of the dragged view.
	 */
	const getDragPositionData = useCallback(
		(parentPosition: Position) => getDragPositionDataFromRegistry(registryRef.current, parentPosition),
		[],
	);

	/**
	 * Find all monitoring views and the latest receptive view that
	 * contain the touch coordinates, excluding the specified view.
	 */
	const findMonitorsAndReceiver = useCallback(
		(screenPosition: Position, excludeViewId: string) => (
			findMonitorsAndReceiverInRegistry(registryRef.current, screenPosition, excludeViewId)
		),
		[],
	);

	/**
	 *
	 * Imperative methods without state reactions (data management only).
	 *
	 */

	/** Update a view's protocol callbacks/data. */
	const updateViewProtocol = useCallback(
		(payload: UpdateViewProtocolPayload) => updateViewProtocolInRegistry(registryRef.current, payload),
		[],
	);

	/** Update a view's measurements. */
	const updateViewMeasurements = useCallback(
		(payload: UpdateViewMeasurementsPayload) => updateViewMeasurementsInRegistry(registryRef.current, payload),
		[],
	);

	/**
	 *
	 * Imperative methods with potential state reactions.
	 *
	 */

	/** Register a Drax view. */
	const registerView = useCallback(
		(payload: RegisterViewPayload) => multiDispatch(
			registerViewInRegistry(registryRef.current, payload),
		),
		[multiDispatch],
	);

	/** Reset the receiver in drag tracking, if any. */
	const resetReceiver = useCallback(
		() => multiDispatch(resetReceiverInRegistry(registryRef.current)),
		[multiDispatch],
	);

	/** Reset drag tracking, if any. */
	const resetDrag = useCallback(
		() => multiDispatch(resetDragInRegistry(registryRef.current)),
		[multiDispatch],
	);

	/** Start tracking a drag. */
	const startDrag = useCallback(
		(payload: StartDragPayload) => multiDispatch(startDragInRegistry(registryRef.current, payload)),
		[multiDispatch],
	);

	/** Update the receiver for a drag. */
	const updateReceiver = useCallback(
		(receiver: DraxFoundAbsoluteViewEntry, dragged: DraxAbsoluteViewEntry) => (
			multiDispatch(updateReceiverInRegistry(registryRef.current, receiver, dragged))
		),
		[multiDispatch],
	);

	/** Set the monitors for a drag. */
	const setMonitorIds = useCallback(
		(monitorIds: string[]) => multiDispatch(setMonitorIdsInRegistry(registryRef.current, monitorIds)),
		[multiDispatch],
	);

	/** Unregister a Drax view. */
	const unregisterView = useCallback(
		(payload: UnregisterViewPayload) => multiDispatch(unregisterViewInRegistry(registryRef.current, payload)),
		[multiDispatch],
	);

	/** Create the Drax registry object for return, only replacing reference when necessary. */
	const draxRegistry = useMemo(
		() => ({
			getViewData,
			getAbsoluteViewData,
			getTrackingDragged,
			getTrackingReceiver,
			getTrackingMonitorIds,
			getTrackingMonitors,
			getDragPositionData,
			findMonitorsAndReceiver,
			registerView,
			updateViewProtocol,
			updateViewMeasurements,
			resetReceiver,
			resetDrag,
			startDrag,
			updateReceiver,
			setMonitorIds,
			unregisterView,
		}),
		[
			getViewData,
			getAbsoluteViewData,
			getTrackingDragged,
			getTrackingReceiver,
			getTrackingMonitorIds,
			getTrackingMonitors,
			getDragPositionData,
			findMonitorsAndReceiver,
			registerView,
			updateViewProtocol,
			updateViewMeasurements,
			resetReceiver,
			resetDrag,
			startDrag,
			updateReceiver,
			setMonitorIds,
			unregisterView,
		],
	);

	return draxRegistry;
};