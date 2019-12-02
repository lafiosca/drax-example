import { ActionType, createAction } from 'typesafe-actions';

import {
	RegisterViewPayload,
	UnregisterViewPayload,
	UpdateViewProtocolPayload,
	MeasureViewPayload,
	UpdateActivityPayload,
	UpdateActivitiesPayload,
} from '../types';

export const actions = {
	registerView: createAction('registerView')<RegisterViewPayload>(),
	unregisterView: createAction('unregisterView')<UnregisterViewPayload>(),
	updateViewProtocol: createAction('updateViewProtocol')<UpdateViewProtocolPayload>(),
	measureView: createAction('measureView')<MeasureViewPayload>(),
	updateActivity: createAction('updateActivity')<UpdateActivityPayload>(),
	updateActivities: createAction('updateActivities')<UpdateActivitiesPayload>(),
};

export type DraxAction = ActionType<typeof actions>;
