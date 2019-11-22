import React from 'react';
import {
	SafeAreaView,
	StyleSheet,
	StatusBar,
} from 'react-native';

import { Box } from './Box';
import { DraxProvider, createDraxStore } from './Drax';

const drax1 = createDraxStore({ foo: 23 });
const drax2 = createDraxStore({ foo: 17 });

const App = () => {
	return (
		<>
			<StatusBar barStyle="dark-content" />
			<SafeAreaView style={styles.container}>
				<DraxProvider store={drax1}>
					<Box style={styles.blueBox} name="blue" />
					<Box style={styles.greenBox} name="green" />
				</DraxProvider>
				<DraxProvider store={drax2}>
					<Box style={styles.blueBox} name="blue" />
					<Box style={styles.greenBox} name="green" />
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
		flex: 1,
		backgroundColor: '#aaaaff',
	},
	greenBox: {
		margin: 12,
		flex: 1,
		backgroundColor: '#aaffaa',
	},
});

export default App;
