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
	Ref,
	ReactNode,
	ReactElement,
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
	Animated,
} from 'react-native';
import { createAction, ActionType, getType } from 'typesafe-actions';
import {
	PanGestureHandler,
	PanGestureHandlerGestureEvent,
	PanGestureHandlerStateChangeEvent,
} from 'react-native-gesture-handler';
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
			const { id } = action.payload;
			return {
				...state,
				viewIds: state.viewIds.indexOf(id) < 0 ? [...state.viewIds, id] : state.viewIds,
				viewDataById: {
					...state.viewDataById,
					[id]: {},
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
			// const niceState: any = {
			// 	...state,
			// 	viewDataById: {},
			// };
			// Object.keys(state.viewDataById).forEach((key) => {
			// 	const { ref, ...viewData } = state.viewDataById[key];
			// 	niceState.viewDataById[key] = viewData;
			// });
			console.log(`Rendering drax state: ${JSON.stringify(state, null, 2)}`);
		}
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

export interface DraxViewProps<TDragPayload, TReceiverPayload> extends ViewProps {
	onDragStart?: () => void;
	onDrag?: () => void;
	onDragEnter?: (payload: TReceiverPayload) => void;
	onDragOver?: (payload: TReceiverPayload) => void;
	onDragExit?: (payload: TReceiverPayload) => void;
	onDragEnd?: () => void;
	onDrop?: (payload: TReceiverPayload) => void;

	onReceiveDragEnter?: (payload: TDragPayload) => void;
	onReceiveDragOver?: (payload: TDragPayload) => void;
	onReceiveDragExit?: (payload: TDragPayload) => void;
	onReceiveDrop?: (payload: TDragPayload) => void;

	dragPayload?: TDragPayload;
	receiverPayload?: TReceiverPayload;
}

interface AnimatedViewRef { // workaround for lack of Animated.View type
	getNode: () => View;
}

export const DraxView = <TDragPayload, TReceiverPayload = TDragPayload>(
	{
		onDragStart,
		onDrag,
		onDragEnter,
		onDragOver,
		onDragExit,
		onDragEnd,
		onDrop,
		onReceiveDragEnter,
		onReceiveDragOver,
		onReceiveDragExit,
		onReceiveDrop,
		dragPayload,
		receiverPayload,
		children,
		...props
	}: PropsWithChildren<DraxViewProps<TDragPayload, TReceiverPayload>>,
): ReactElement | null => {
	const [id, setId] = useState('');
	const ref = useRef<AnimatedViewRef>(null);
	const {
		registerView,
		unregisterView,
		measureView,
	} = useDrax();
	useEffect(() => { setId(uuid()); }, []); // initialize id once
	useEffect(
		() => {
			if (!id) {
				return undefined;
			}
			registerView({
				id,
			});
			return () => unregisterView({ id });
		},
		[id],
	);
	const onHandlerStateChange = useCallback(
		(event: PanGestureHandlerStateChangeEvent) => {
			console.log(`state change ${event.nativeEvent.oldState} -> ${event.nativeEvent.state}`);
			console.log(`trans (${event.nativeEvent.translationX}, ${event.nativeEvent.translationY})`);
			console.log(`abs (${event.nativeEvent.absoluteX}, ${event.nativeEvent.absoluteY})`);
		},
		[],
	);
	const onGestureEvent = useCallback(
		(event: PanGestureHandlerGestureEvent) => {
			console.log('gesture event');
			console.log(`trans (${event.nativeEvent.translationX}, ${event.nativeEvent.translationY})`);
			console.log(`abs (${event.nativeEvent.absoluteX}, ${event.nativeEvent.absoluteY})`);
		},
		[],
	);
	const onLayout = useCallback(
		() => {
			if (ref.current) {
				ref.current.getNode().measure((x, y, width, height, pageX, pageY) => measureView({
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
		<PanGestureHandler
			onHandlerStateChange={onHandlerStateChange}
			onGestureEvent={onGestureEvent}
		>
			<Animated.View
				{...props}
				ref={ref}
				onLayout={onLayout}
			>
				{children}
			</Animated.View>
		</PanGestureHandler>
	);
};

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
