import React, { FunctionComponent, useState } from 'react';

interface DraxStore {
	foo: number;
}

interface DraxContextValue extends DraxStore {
	updateFoo: (newFoo: number) => void;
}

interface DraxOptions {
	foo?: number;
}

const defaultValue: DraxContextValue = {
	foo: 0,
	updateFoo: () => {
		console.log('do nothing');
	},
};

export const createDraxStore = ({ foo: initialFoo = 0 }: DraxOptions): DraxStore => {
	const foo: number = initialFoo;
	return { foo };
};

export const DraxContext = React.createContext<DraxContextValue>(defaultValue);

DraxContext.displayName = 'Drax';

interface DraxProviderProps {
	store: DraxStore;
}

export const DraxProvider: FunctionComponent<DraxProviderProps> = ({ store, children }) => {
	const [foo, updateFoo] = useState(store.foo);
	return (
		<DraxContext.Provider value={{ foo, updateFoo }}>
			{children}
		</DraxContext.Provider>
	);
};
