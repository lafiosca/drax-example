import React, { FunctionComponent } from 'react';
import {
	ViewProps,
	View,
	Text,
	Button,
} from 'react-native';

import { useDrax } from './Drax';

interface Props extends ViewProps {
	name: string;
}

export const Box: FunctionComponent<Props> = ({ name, ...props }) => {
	const { foo, incrementFoo, decrementFoo } = useDrax();
	return (
		<View {...props}>
			<Text>{`Zone ${name} (context.foo = ${foo})`}</Text>
			<Button onPress={incrementFoo} title="+" />
			<Button onPress={decrementFoo} title="-" />
		</View>
	);
};
