import { createAction, ActionType } from 'typesafe-actions';

import {
	CreateViewStatePayload,
	UpdateViewStatePayload,
	DeleteViewStatePayload,
	UpdateTrackingStatusPayload,
} from '../types';

/** Collection of Drax action creators */
export const actions = {
	createViewState: createAction('createViewState')<CreateViewStatePayload>(),
	updateViewState: createAction('updateViewState')<UpdateViewStatePayload>(),
	deleteViewState: createAction('deleteViewState')<DeleteViewStatePayload>(),
	updateTrackingStatus: createAction('updateTrackingStatus')<UpdateTrackingStatusPayload>(),
};

/** A dispatchable Drax action */
export type DraxAction = ActionType<typeof actions>;

/** A dispatcher of Drax actions */
export type DraxDispatch = (action: DraxAction) => void;
