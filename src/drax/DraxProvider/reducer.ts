import { getType } from 'typesafe-actions';
import { Animated } from 'react-native';

import {
	DraxState,
	DraxActivity,
	DraxDraggedViewState,
	DraxReceiverViewState,
	DraxProtocol,
} from '../types';
import { DraxAction, actions } from './actions';
import { selectViewData } from './selectors';

const createInitialActivity = (): DraxActivity => ({
	dragState: DraxDraggedViewState.Inactive,
	dragOffset: new Animated.ValueXY({ x: 0, y: 0 }),
	draggingOverReceiverPayload: undefined,
	receiverState: DraxReceiverViewState.Inactive,
	receiverOffset: new Animated.ValueXY({ x: 0, y: 0 }),
	receivingDragPayload: undefined,
});

export const initialState: DraxState = {
	viewIds: [],
	viewDataById: {},
};

export const reducer = (state: DraxState, action: DraxAction): DraxState => {
	switch (action.type) {
		case getType(actions.registerView): {
			const { id } = action.payload;

			// Make sure not to duplicate registered view id.
			const viewIds = state.viewIds.indexOf(id) < 0 ? [...state.viewIds, id] : state.viewIds;

			// Make sure not to overwrite existing view data.
			const existingData = selectViewData(state, id);

			return {
				...state,
				viewIds,
				viewDataById: {
					...state.viewDataById,
					...(existingData
						? {}
						: {
							[id]: {
								protocol: {
									draggable: false,
									receptive: false,
								},
								activity: createInitialActivity(),
							},
						}
					),
				},
			};
		}
		case getType(actions.unregisterView): {
			const { id } = action.payload;
			const { [id]: removed, ...viewDataById } = state.viewDataById;
			return {
				...state,
				viewDataById,
				viewIds: state.viewIds.filter((thisId) => thisId !== id),
			};
		}
		case getType(actions.updateViewProtocol): {
			const { id, protocol: protocolProps } = action.payload;

			const existingData = selectViewData(state, id);
			if (!existingData) {
				return state;
			}

			// Determine required and coalesced values if not explicitly provided.
			const protocol: DraxProtocol = {
				...protocolProps,
				draggable: protocolProps.draggable ?? (!!protocolProps.dragPayload
					|| !!protocolProps.payload
					|| !!protocolProps.onDrag
					|| !!protocolProps.onDragEnd
					|| !!protocolProps.onDragEnter
					|| !!protocolProps.onDragExit
					|| !!protocolProps.onDragOver
					|| !!protocolProps.onDragStart
					|| !!protocolProps.onDragDrop),
				receptive: protocolProps.receptive ?? (!!protocolProps.receiverPayload
					|| !!protocolProps.payload
					|| !!protocolProps.onReceiveDragEnter
					|| !!protocolProps.onReceiveDragExit
					|| !!protocolProps.onReceiveDragOver
					|| !!protocolProps.onReceiveDragDrop),
				dragPayload: protocolProps.dragPayload ?? protocolProps.payload,
				receiverPayload: protocolProps.receiverPayload ?? protocolProps.payload,
			};

			return {
				...state,
				viewDataById: {
					...state.viewDataById,
					[id]: {
						...existingData,
						protocol,
					},
				},
			};
		}
		case getType(actions.measureView): {
			const { id, measurements } = action.payload;

			const existingData = selectViewData(state, id);
			if (!existingData) {
				return state;
			}

			return {
				...state,
				viewDataById: {
					...state.viewDataById,
					[id]: {
						...existingData,
						measurements,
					},
				},
			};
		}
		case getType(actions.updateActivity): {
			const { id, activity } = action.payload;
			const existingData = selectViewData(state, id);
			return {
				...state,
				viewDataById: {
					...state.viewDataById,
					...(existingData
						? {
							[id]: {
								...existingData,
								activity: {
									...existingData.activity,
									...activity,
								},
							},
						}
						: {}
					),
				},
			};
		}
		case getType(actions.updateActivities): {
			const { activities } = action.payload;
			const viewDataById = activities.reduce(
				(prevViewDataById, { id, activity }) => {
					const existingData = selectViewData(state, id);
					return {
						...prevViewDataById,
						...(existingData
							? {
								[id]: {
									...existingData,
									activity: {
										...existingData.activity,
										...activity,
									},
								},
							}
							: {}
						),
					};
				},
				state.viewDataById,
			);
			return {
				...state,
				viewDataById,
			};
		}
		default:
			return state;
	}
};
