import React, { FunctionComponent } from 'react';
import { Text } from 'react-native';

import { DraxViewProps, DraxView } from './Drax';

interface Props extends DraxViewProps {
	name: string;
}

export const Box: FunctionComponent<Props> = ({ name, ...props }) => (
	<DraxView {...props}>
		<Text>{`Zone ${name}`}</Text>
	</DraxView>
);
