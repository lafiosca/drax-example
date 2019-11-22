import React, { FunctionComponent, useContext } from 'react';
import { ViewProps, View, Text } from 'react-native';

import { DraxContext } from './Drax';

interface Props extends ViewProps {
	name: string;
}

export const Box: FunctionComponent<Props> = ({ name, ...props }) => {
	const context = useContext(DraxContext);
	return (
		<View {...props}>
			<Text>{`Zone ${name} (context.foo = ${context?.foo})`}</Text>
		</View>
	);
};
