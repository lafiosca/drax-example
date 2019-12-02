import { DraxState, DraxStateViewData } from '../types';

/** Select data for a registered view by its id */
export const selectViewData = (state: DraxState, id: string | undefined): DraxStateViewData | undefined => (
	(id && state.viewIds.includes(id)) ? state.viewDataById[id] : undefined
);
