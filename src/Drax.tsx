import React, {
	FunctionComponent,
	createContext,
	useReducer,
	useCallback,
	useContext,
} from 'react';
import { createAction, ActionType, getType } from 'typesafe-actions';

interface DraxContextValue {
	foo: number;
	incrementFoo: () => void;
	decrementFoo: () => void;
}

const DraxContext = createContext<DraxContextValue | undefined>(undefined);
DraxContext.displayName = 'Drax';

interface DraxState {
	foo: number;
}

const initialState: DraxState = {
	foo: 0,
};

const increment = createAction('increment')();
const decrement = createAction('decrement')();

const draxActions = { increment, decrement };

type DraxAction = ActionType<typeof draxActions>;

const reducer = (state: DraxState, action: DraxAction): DraxState => {
	switch (action.type) {
		case getType(increment):
			return {
				...state,
				foo: state.foo + 1,
			};
		case getType(decrement):
			return {
				...state,
				foo: state.foo - 1,
			};
		default:
			return state;
	}
};

interface DraxProviderProps {
}

export const DraxProvider: FunctionComponent<DraxProviderProps> = ({ children }) => {
	const [{ foo }, dispatch] = useReducer(reducer, initialState);
	const incrementFoo = useCallback(
		() => dispatch(increment()),
		[dispatch],
	);
	const decrementFoo = useCallback(
		() => dispatch(decrement()),
		[dispatch],
	);
	const value: DraxContextValue = {
		foo,
		incrementFoo,
		decrementFoo,
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
