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

interface Cargo {
	drag?: number;
	receiver?: number;
}

const App = () => {
	const [count, setCount] = useState(0);
	return (
		<>
			<StatusBar barStyle="dark-content" />
			<SafeAreaView style={styles.container}>
				<DraxProvider>
					<DraxView
						style={styles.blueBox}
						onDragStart={() => { console.log('start dragging blue'); }}
						onDrag={() => { console.log('drag blue'); }}
						onDragEnd={() => { console.log('stop dragging blue'); }}
						onDragEnter={(payload: Cargo) => { console.log(`drag blue into: ${JSON.stringify(payload, null, 2)}`); }}
						onDragOver={(payload: Cargo) => { console.log(`drag blue over: ${JSON.stringify(payload, null, 2)}`); }}
						onDragExit={(payload: Cargo) => { console.log(`drag blue out of: ${JSON.stringify(payload, null, 2)}`); }}
						onDragDrop={(payload: Cargo) => { console.log(`drop blue into: ${JSON.stringify(payload, null, 2)}`); }}
						dragPayload={{ drag: 1 }}
					/>
					<DraxView
						style={styles.greenBox}
						onReceiveDragDrop={(payload: Cargo) => {
							console.log(`green received drop: ${JSON.stringify(payload, null, 2)}`);
						}}
						receiverPayload={{ receiver: 2 }}
					/>
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
