import React, { useState } from 'react';
import {
	SafeAreaView,
	StyleSheet,
	StatusBar,
	View,
	ScrollView,
	FlatList,
	ListRenderItemInfo,
	Button,
} from 'react-native';

import { Box } from './Box';
import { DraxProvider, DraxDebug } from './Drax';

const items = [
	'blue',
	'green',
	'red',
	'yellow',
	'cyan',
];

const renderItem = ({ item }: ListRenderItemInfo<string>) => (
	<Box style={styles[`${item}Box`]} name={item} />
);

const App = () => {
	const [count, setCount] = useState(0);
	return (
		<>
			<StatusBar barStyle="dark-content" />
			<SafeAreaView style={styles.container}>
				<DraxProvider>
					<DraxDebug />
					<View style={{ height: 135 }} />
					<View style={{ paddingTop: 0 }}>
						<Box style={styles.blueBox} name="blue" />
					</View>
					{/* <ScrollView>
						<Box style={styles.blueBox} name="blue" />
						<Box style={styles.greenBox} name="green" />
						<Box style={styles.redBox} name="red" />
						<Box style={styles.yellowBox} name="yellow" />
						<Box style={styles.cyanBox} name="cyan" />
					</ScrollView> */}
					{/* <FlatList
						data={items.slice(0, count)}
						renderItem={renderItem}
						keyExtractor={(item) => item}
					/> */}
					{/* <Button title="+" onPress={() => setCount(count + 1)} />
					<Button title="-" onPress={() => setCount(count - 1)} /> */}
				</DraxProvider>
				{/* <DraxProvider>
					<Box style={styles.blueBox} name="blue" />
					<Box style={styles.greenBox} name="green" />
				</DraxProvider> */}
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
