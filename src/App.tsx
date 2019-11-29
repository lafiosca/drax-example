import React from 'react';
import {
	SafeAreaView,
	StyleSheet,
	StatusBar,
	Text,
} from 'react-native';

import { DraxProvider, DraxView } from './Drax';

interface Cargo {
	drag?: number;
	receiver?: number;
}

const App = () => {
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
						dragPayload={{ boxName: 'blue' }}
					>
						<Text>draggable only</Text>
					</DraxView>
					<DraxView
						style={styles.greenBox}
						draggable
						onReceiveDragDrop={(payload: Cargo) => {
							console.log(`green received drop: ${JSON.stringify(payload, null, 2)}`);
						}}
						payload={{ boxName: 'green' }}
					>
						<Text>draggable and receptive</Text>
					</DraxView>
					<DraxView
						style={styles.yellowBox}
						onReceiveDragDrop={(payload: Cargo) => {
							console.log(`yellow received drop: ${JSON.stringify(payload, null, 2)}`);
						}}
						payload={{ boxName: 'yellow' }}
					>
						<Text>receptive only</Text>
					</DraxView>
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
		height: 200,
		backgroundColor: '#aaaaff',
	},
	greenBox: {
		margin: 12,
		width: 'auto',
		height: 200,
		backgroundColor: '#aaffaa',
	},
	redBox: {
		margin: 12,
		width: 'auto',
		height: 200,
		backgroundColor: '#ffaaaa',
	},
	yellowBox: {
		margin: 12,
		width: 'auto',
		height: 200,
		backgroundColor: '#ffffaa',
	},
	cyanBox: {
		margin: 12,
		width: 'auto',
		height: 200,
		backgroundColor: '#aaffff',
	},
});

export default App;
