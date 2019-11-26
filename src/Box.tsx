import React, { PropsWithChildren, forwardRef } from 'react';
import { Text, View } from 'react-native';

import { DraxViewProps, DraxView } from './Drax';

interface BoxProps extends DraxViewProps {
	name: string;
}

export const Box = forwardRef<View, PropsWithChildren<BoxProps>>(({ name, ...props }, ref) => (
	<DraxView {...props} ref={ref}>
		<Text>{`Zone ${name}`}</Text>
	</DraxView>
));

export const Box2 = forwardRef<View, PropsWithChildren<BoxProps>>(({ name, ...props }, ref) => (
	<View {...props} ref={ref}>
		<Text>{`Zone ${name}`}</Text>
	</View>
));
