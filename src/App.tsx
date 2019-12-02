import React, { useState } from 'react';
import {
	SafeAreaView,
	StyleSheet,
	StatusBar,
	Text,
	View,
} from 'react-native';

import { DraxProvider, DraxView } from './drax';

interface Cargo {
	boxName?: string;
	letter?: string;
}

const App = () => {
	const [greenReceived, setGreenReceived] = useState<string[]>([]);
	const [yellowReceived, setYellowReceived] = useState<string[]>([]);
	return (
		<>
			<StatusBar barStyle="dark-content" />
			<SafeAreaView style={styles.container}>
				<DraxProvider>
					<DraxView
						style={styles.blueBox}
						draggingStyle={styles.dragHighlight}
						dragReleasedStyle={styles.dragReleaseHighlight}
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
						draggingStyle={styles.dragHighlight}
						dragReleasedStyle={styles.dragReleaseHighlight}
						receivingStyle={styles.receiveHighlight}
						draggable
						onReceiveDragDrop={(payload: Cargo) => {
							console.log(`green received drop: ${JSON.stringify(payload, null, 2)}`);
							setGreenReceived([
								...greenReceived,
								payload.letter ?? payload.boxName ?? '?',
							]);
						}}
						dragReleaseAnimationDelay={500}
						dragReleaseAnimationDuration={1000}
						payload={{ boxName: 'green' }}
					>
						<Text>draggable and receptive</Text>
						<Text style={styles.receivedText}>{`received: ${greenReceived.join('-')}`}</Text>
					</DraxView>
					<DraxView
						style={styles.yellowBox}
						receivingStyle={styles.receiveHighlight}
						onReceiveDragDrop={(payload: Cargo) => {
							console.log(`yellow received drop: ${JSON.stringify(payload, null, 2)}`);
							setYellowReceived([
								...yellowReceived,
								payload.letter ?? payload.boxName ?? '?',
							]);
						}}
						receiverPayload={{ boxName: 'yellow' }}
					>
						<Text>receptive only</Text>
						<Text style={styles.receivedText}>{`received: ${yellowReceived.join('-')}`}</Text>
					</DraxView>
					<View style={styles.bottomRow}>
						<DraxView dragPayload={{ letter: 'X' }}>
							<View style={styles.bottomBox}>
								<Text style={styles.bottomBoxText}>X</Text>
							</View>
						</DraxView>
						<DraxView dragPayload={{ letter: 'Y' }}>
							<View style={styles.bottomBox}>
								<Text style={styles.bottomBoxText}>Y</Text>
							</View>
						</DraxView>
						<DraxView dragPayload={{ letter: 'Z' }}>
							<View style={styles.bottomBox}>
								<Text style={styles.bottomBoxText}>Z</Text>
							</View>
						</DraxView>
					</View>
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
	yellowBox: {
		margin: 12,
		width: 'auto',
		height: 200,
		backgroundColor: '#ffffaa',
	},
	dragHighlight: {
		borderWidth: 3,
		borderColor: 'red',
	},
	dragReleaseHighlight: {
		borderWidth: 3,
		borderColor: 'grey',
	},
	receiveHighlight: {
		borderWidth: 3,
		borderColor: 'magenta',
	},
	receivedText: {
		marginTop: 8,
	},
	bottomRow: {
		flexDirection: 'row',
		justifyContent: 'flex-start',
		alignItems: 'center',
	},
	bottomBox: {
		margin: 12,
		width: 40,
		height: 50,
		borderRadius: 10,
		backgroundColor: 'grey',
		justifyContent: 'center',
		alignItems: 'center',
	},
	bottomBoxText: {
		fontSize: 18,
		color: 'black',
	},
});

export default App;
