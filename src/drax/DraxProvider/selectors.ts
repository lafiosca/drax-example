import { DraxState, DraxViewData } from '../types';

/** Select data for a registered view by its id */
export const selectViewData = (state: DraxState, id: string | undefined): DraxViewData | undefined => (
	(id && state.viewIds.includes(id)) ? state.viewDataById[id] : undefined
);
