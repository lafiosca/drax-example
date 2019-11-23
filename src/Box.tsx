import React, { FunctionComponent, useContext, useCallback } from 'react';
import {
	ViewProps,
	View,
	Text,
	Button,
} from 'react-native';

import { DraxContext } from './Drax';

interface Props extends ViewProps {
	name: string;
}

export const Box: FunctionComponent<Props> = ({ name, ...props }) => {
	const { foo, updateFoo } = useContext(DraxContext);
	const onPress = useCallback(
		() => {
			console.log(`Increment foo from ${foo} to ${foo + 1}`);
			updateFoo(foo + 1);
		},
		[foo, updateFoo],
	);
	return (
		<View {...props}>
			<Text>{`Zone ${name} (context.foo = ${foo})`}</Text>
			<Button onPress={onPress} title="+" />
		</View>
	);
};
