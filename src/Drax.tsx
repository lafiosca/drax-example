import React, {
	FunctionComponent,
	createContext,
	useReducer,
	useCallback,
	useContext,
} from 'react';

interface DraxContextValue {
	foo: number;
	incrementFoo: () => void;
	decrementFoo: () => void;
}

const defaultValue: DraxContextValue = {
	foo: 0,
	incrementFoo: () => {},
	decrementFoo: () => {},
};

const DraxContext = createContext<DraxContextValue>(defaultValue);
DraxContext.displayName = 'Drax';

interface DraxState {
	foo: number;
}

const initialState: DraxState = {
	foo: 0,
};

const reducer = (state: DraxState, action: any) => {
	switch (action.type) {
		case 'increment':
			return {
				...state,
				foo: state.foo + 1,
			};
		case 'decrement':
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
		() => dispatch({ type: 'increment' }),
		[dispatch],
	);
	const decrementFoo = useCallback(
		() => dispatch({ type: 'decrement' }),
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

export const useDrax = () => useContext(DraxContext);
