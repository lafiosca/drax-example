import React, { FunctionComponent } from 'react';

interface DraxStore {
	foo: number;
	updateFoo: (newFoo: number) => void;
}

interface DraxOptions {
	foo?: number;
}

export const createDraxStore = ({ foo: initialFoo = 0 }: DraxOptions): DraxStore => {
	let foo: number = initialFoo;
	const updateFoo = (newFoo: number) => {
		foo = newFoo;
	};
	return { foo, updateFoo };
};

export const DraxContext = React.createContext<DraxStore | undefined>(undefined);

DraxContext.displayName = 'Drax';

interface DraxProviderProps {
	store: DraxStore;
}

export const DraxProvider: FunctionComponent<DraxProviderProps> = ({ store, children }) => (
	<DraxContext.Provider value={store}>
		{children}
	</DraxContext.Provider>
);
