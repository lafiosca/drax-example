import { createAction } from 'typesafe-actions';

import {
	DraxStateActionCreators,
	CreateViewStatePayload,
	UpdateViewStatePayload,
	DeleteViewStatePayload,
	UpdateTrackingStatusPayload,
} from '../types';

/** Collection of Drax action creators */
export const actions: DraxStateActionCreators = {
	createViewState: createAction('createViewState')<CreateViewStatePayload>(),
	updateViewState: createAction('updateViewState')<UpdateViewStatePayload>(),
	deleteViewState: createAction('deleteViewState')<DeleteViewStatePayload>(),
	updateTrackingStatus: createAction('updateTrackingStatus')<UpdateTrackingStatusPayload>(),
};
