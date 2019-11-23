import React, {
	FunctionComponent,
	createContext,
	useReducer,
	useCallback,
	useContext,
	useEffect,
	useState,
} from 'react';
import {
	LayoutChangeEvent,
	LayoutRectangle,
	ViewProps,
	View,
} from 'react-native';
import { createAction, ActionType, getType } from 'typesafe-actions';
import uuid from 'uuid/v4';

interface DraxState {
	viewIds: string[];
	layoutsByViewId: {
		[id: string]: LayoutRectangle;
	}
}

const initialState: DraxState = {
	viewIds: [],
	layoutsByViewId: {},
};

interface RegisterViewPayload {
	id: string;
}

interface UnregisterViewPayload {
	id: string;
}

interface UpdateViewLayoutPayload {
	id: string;
	layout: LayoutRectangle;
}

const actions = {
	registerView: createAction('registerView')<RegisterViewPayload>(),
	unregisterView: createAction('unregisterView')<UnregisterViewPayload>(),
	updateViewLayout: createAction('updateViewLayout')<UpdateViewLayoutPayload>(),
};

type DraxAction = ActionType<typeof actions>;

const reducer = (state: DraxState, action: DraxAction): DraxState => {
	switch (action.type) {
		case getType(actions.registerView): {
			const { id } = action.payload;
			return {
				...state,
				viewIds: state.viewIds.indexOf(id) < 0 ? [...state.viewIds, id] : state.viewIds,
			};
		}
		case getType(actions.unregisterView): {
			const { id } = action.payload;
			const { [id]: removedLayout, ...layoutsByViewId } = state.layoutsByViewId;
			return {
				...state,
				layoutsByViewId,
				viewIds: state.viewIds.filter((thisId) => thisId !== id),
			};
		}
		case getType(actions.updateViewLayout): {
			const { id, layout } = action.payload;
			console.log(`reducer update (${id}, ${JSON.stringify(layout, null, 2)})`);
			return {
				...state,
				layoutsByViewId: {
					...state.layoutsByViewId,
					...(state.viewIds.indexOf(id) < 0 ? {} : { [id]: layout }),
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
	updateViewLayout: (payload: UpdateViewLayoutPayload) => void;
}

const DraxContext = createContext<DraxContextValue | undefined>(undefined);
DraxContext.displayName = 'Drax';

export interface DraxProviderProps {
}

export const DraxProvider: FunctionComponent<DraxProviderProps> = ({ children }) => {
	const [state, dispatch] = useReducer(reducer, initialState);
	const registerView = useCallback(
		(payload: RegisterViewPayload) => dispatch(actions.registerView(payload)),
		[dispatch],
	);
	const unregisterView = useCallback(
		(payload: UnregisterViewPayload) => dispatch(actions.unregisterView(payload)),
		[dispatch],
	);
	const updateViewLayout = useCallback(
		(payload: UpdateViewLayoutPayload) => dispatch(actions.updateViewLayout(payload)),
		[dispatch],
	);
	const value: DraxContextValue = {
		state,
		registerView,
		unregisterView,
		updateViewLayout,
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

export const DraxDebug: FunctionComponent = () => {
	const { state } = useDrax();
	console.log(`Rendering drax state: ${JSON.stringify(state, null, 2)}`);
	return null;
};

export interface DraxViewProps extends ViewProps {}

export const DraxView: FunctionComponent<DraxViewProps> = ({ children, ...props }) => {
	const [id, setId] = useState('');
	const {
		state,
		registerView,
		unregisterView,
		updateViewLayout,
	} = useDrax();
	useEffect(
		() => {
			const newId = uuid();
			setId(newId);
			console.log(`registering view id ${newId}`);
			registerView({ id: newId });
			return () => {
				console.log(`unregistering view id ${newId}`);
				unregisterView({ id: newId });
			};
		},
		[],
	);
	const onLayout = useCallback(
		(event: LayoutChangeEvent) => {
			const { layout } = event.nativeEvent;
			updateViewLayout({ id, layout });
		},
		[id],
	);
	if (!id) {
		return null;
	}
	return (
		<View
			{...props}
			onLayout={onLayout}
		>
			{children}
		</View>
	);
};
