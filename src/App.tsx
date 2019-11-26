import React, { useState } from 'react';
import {
	SafeAreaView,
	StyleSheet,
	StatusBar,
	Button,
} from 'react-native';

import { DraxProvider, DraxView } from './Drax';

// const items = [
// 	'blue',
// 	'green',
// 	'red',
// 	'yellow',
// 	'cyan',
// ];

interface DX {
	a: number;
	b?: string;
}

const App = () => {
	const [count, setCount] = useState(0);
	return (
		<>
			<StatusBar barStyle="dark-content" />
			<SafeAreaView style={styles.container}>
				<DraxProvider debug>
					<DraxView
						style={styles.blueBox}
						onReceiveDragEnter={(payload: DX) => {
							console.log(`received payload: ${JSON.stringify(payload, null, 2)}`);
						}}
						dragPayload={{ a: 1 }}
					/>
					<DraxView style={styles.greenBox} />
					<Button title="+" onPress={() => setCount(count + 1)} />
					<Button title="-" onPress={() => setCount(count - 1)} />
				</DraxProvider>
			</SafeAreaView>
		</>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	blueBox: {
		margin: 12,
		width: 'auto',
		height: 300,
		backgroundColor: '#aaaaff',
	},
	greenBox: {
		margin: 12,
		width: 'auto',
		height: 300,
		backgroundColor: '#aaffaa',
	},
	redBox: {
		margin: 12,
		width: 'auto',
		height: 300,
		backgroundColor: '#ffaaaa',
	},
	yellowBox: {
		margin: 12,
		width: 'auto',
		height: 300,
		backgroundColor: '#ffffaa',
	},
	cyanBox: {
		margin: 12,
		width: 'auto',
		height: 300,
		backgroundColor: '#aaffff',
	},
});

export default App;
