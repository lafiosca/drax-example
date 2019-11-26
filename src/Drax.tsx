import React, {
	FunctionComponent,
	RefObject,
	PropsWithChildren,
	createContext,
	useReducer,
	useCallback,
	useContext,
	useEffect,
	useState,
	useRef,
	forwardRef,
} from 'react';
import {
	LayoutChangeEvent,
	ViewProps,
	View,
	FlatList,
	FlatListProps,
	NativeSyntheticEvent,
	NativeScrollEvent,
	MeasureOnSuccessCallback,
} from 'react-native';
import { createAction, ActionType, getType } from 'typesafe-actions';
import composeRefs from '@seznam/compose-react-refs';
import uuid from 'uuid/v4';

interface MeasureData {
	x: number;
	y: number;
	width: number;
	height: number;
	pageX: number;
	pageY: number;
}

interface DraxState {
	viewIds: string[];
	viewDataById: {
		[id: string]: {
			ref: RefObject<View>;
			measureData?: MeasureData;
		}
	}
}

const initialState: DraxState = {
	viewIds: [],
	viewDataById: {},
};

interface RegisterViewPayload {
	id: string;
	ref: RefObject<View>;
}

interface UnregisterViewPayload {
	id: string;
}

interface MeasureViewPayload {
	id: string;
	measureData: MeasureData;
}

const actions = {
	registerView: createAction('registerView')<RegisterViewPayload>(),
	unregisterView: createAction('unregisterView')<UnregisterViewPayload>(),
	measureView: createAction('measureView')<MeasureViewPayload>(),
};

type DraxAction = ActionType<typeof actions>;

const reducer = (state: DraxState, action: DraxAction): DraxState => {
	switch (action.type) {
		case getType(actions.registerView): {
			const { id, ref } = action.payload;
			return {
				...state,
				viewIds: state.viewIds.indexOf(id) < 0 ? [...state.viewIds, id] : state.viewIds,
				viewDataById: {
					...state.viewDataById,
					[id]: { ref },
				},
			};
		}
		case getType(actions.unregisterView): {
			const { id } = action.payload;
			const { [id]: removedLayout, ...viewDataById } = state.viewDataById;
			return {
				...state,
				viewDataById,
				viewIds: state.viewIds.filter((thisId) => thisId !== id),
			};
		}
		case getType(actions.measureView): {
			const { id, measureData } = action.payload;
			return {
				...state,
				viewDataById: {
					...state.viewDataById,
					...(state.viewIds.indexOf(id) < 0
						? {}
						: {
							[id]: {
								...state.viewDataById[id],
								measureData,
							},
						}
					),
				},
			};
		}
		default:
			return state;
	}
};

interface DraxContextValue {
	state: DraxState;
	registerView: (payload: RegisterViewPayload) => void;
	unregisterView: (payload: UnregisterViewPayload) => void;
	measureView: (payload: MeasureViewPayload) => void;
}

const DraxContext = createContext<DraxContextValue | undefined>(undefined);
DraxContext.displayName = 'Drax';

export interface DraxProviderProps {
	debug?: boolean;
}

export const DraxProvider: FunctionComponent<DraxProviderProps> = ({ debug = false, children }) => {
	const [state, dispatch] = useReducer(reducer, initialState);
	const registerView = useCallback(
		(payload: RegisterViewPayload) => {
			if (debug) {
				console.log(`Dispatching registerView(${JSON.stringify(payload, null, 2)})`);
			}
			dispatch(actions.registerView(payload));
		},
		[dispatch, debug],
	);
	const unregisterView = useCallback(
		(payload: UnregisterViewPayload) => {
			if (debug) {
				console.log(`Dispatching unregisterView(${JSON.stringify(payload, null, 2)})`);
			}
			dispatch(actions.unregisterView(payload));
		},
		[dispatch, debug],
	);
	const measureView = useCallback(
		(payload: MeasureViewPayload) => {
			if (debug) {
				console.log(`Dispatching measureView(${JSON.stringify(payload, null, 2)})`);
			}
			dispatch(actions.measureView(payload));
		},
		[dispatch, debug],
	);
	useEffect(() => {
		if (debug) {
			const niceState: any = {
				...state,
				viewDataById: {},
			};
			Object.keys(state.viewDataById).forEach((key) => {
				const { ref, ...viewData } = state.viewDataById[key];
				niceState.viewDataById[key] = viewData;
			});
			console.log(`Rendering drax state: ${JSON.stringify(niceState, null, 2)}`);
		}
		// state.viewIds.forEach((id) => {
		// 	const { ref } = state.viewDataById[id];
		// 	if (ref.current) {
		// 		if (debug) {
		// 			console.log(`Measuring viewId ${id}`);
		// 		}
		// 		ref.current.measure((x, y, width, height, pageX, pageY) => measureView({
		// 			id,
		// 			measureData: {
		// 				x,
		// 				y,
		// 				width,
		// 				height,
		// 				pageX,
		// 				pageY,
		// 			},
		// 		}));
		// 	}
		// });
	});
	const value: DraxContextValue = {
		state,
		registerView,
		unregisterView,
		measureView,
	};
	return (
		<DraxContext.Provider value={value}>
			{children}
		</DraxContext.Provider>
	);
};

export const useDrax = () => {
	const drax = useContext(DraxContext);
	if (!drax) {
		throw Error('No DraxProvider found');
	}
	return drax;
};

export interface DraxViewProps extends ViewProps {}

export const DraxView = forwardRef<View, PropsWithChildren<DraxViewProps>>(({ children, ...props }, outerRef) => {
	const [id, setId] = useState('');
	const ref = useRef<View>(null);
	const {
		registerView,
		unregisterView,
		measureView,
	} = useDrax();
	useEffect(
		() => {
			const newId = uuid();
			setId(newId);
			registerView({
				ref,
				id: newId,
			});
			return () => unregisterView({ id: newId });
		},
		[],
	);
	const onLayout = useCallback(
		() => {
			if (ref.current) {
				ref.current.measure((x, y, width, height, pageX, pageY) => measureView({
					id,
					measureData: {
						x,
						y,
						width,
						height,
						pageX,
						pageY,
					},
				}));
			}
		},
		[id, ref],
	);
	return (
		<View
			{...props}
			ref={composeRefs(outerRef, ref)}
			onLayout={onLayout}
		>
			{children}
		</View>
	);
});

// export interface DraxListProps<T> extends FlatListProps<T> {}

// export const DraxList = <T extends unknown>({ ...props }: DraxListProps<T>) => {
// 	const [id, setId] = useState('');
// 	const ref = useRef<FlatList<T>>(null);
// 	const {
// 		registerView,
// 		unregisterView,
// 		updateViewLayout,
// 	} = useDrax();
// 	useEffect(
// 		() => {
// 			const newId = uuid();
// 			setId(newId);
// 			console.log(`registering view id ${newId}`);
// 			registerView({ id: newId });
// 			return () => {
// 				console.log(`unregistering view id ${newId}`);
// 				unregisterView({ id: newId });
// 			};
// 		},
// 		[],
// 	);
// 	const onLayout = useCallback(
// 		(event: LayoutChangeEvent) => {
// 			const { layout } = event.nativeEvent;
// 			updateViewLayout({ id, layout });
// 			// if (ref.current) {
// 			// 	console.log(`Measuring ${id}`);
// 			// 	ref.current._component.measure((x, y, w, h, px, py) => {
// 			// 		console.log(`Measured ${id}: ${JSON.stringify({
// 			// 			x,
// 			// 			y,
// 			// 			w,
// 			// 			h,
// 			// 			px,
// 			// 			py,
// 			// 		}, null, 2)}`);
// 			// 	});
// 			// }
// 		},
// 		[id, ref],
// 	);
// 	const onScroll = useCallback(
// 		(event: NativeSyntheticEvent<NativeScrollEvent>) => {
// 			const {
// 				contentInset,
// 				contentOffset,
// 				contentSize,
// 				layoutMeasurement,
// 				velocity,
// 				zoomScale,
// 			} = event.nativeEvent;
// 			console.log(`onScroll: ${JSON.stringify({
// 				contentInset,
// 				contentOffset,
// 				contentSize,
// 				layoutMeasurement,
// 				velocity,
// 				zoomScale,
// 			}, null, 2)}`);
// 		},
// 		[],
// 	);
// 	if (!id) {
// 		return null;
// 	}
// 	return (
// 		<FlatList
// 			{...props}
// 			ref={ref}
// 			onLayout={onLayout}
// 			onScroll={onScroll}
// 		/>
// 	);
// };
