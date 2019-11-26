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
	Text,
} from 'react-native';
import { LongPressGestureHandler, State } from 'react-native-gesture-handler';

import { Box, Box2 } from './Box';
import { DraxProvider, DraxView } from './Drax';

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
				<DraxProvider debug>
					{/* {items.slice(0, count).map((item) => (
						<View key={`padding${item}`} style={{ height: 23 }} />
					))} */}
					<View style={{ height: 23 * count }} />
					<LongPressGestureHandler
						onHandlerStateChange={({ nativeEvent }) => {
							console.log(`nativeEvent.state = ${nativeEvent.state}`);
							if (nativeEvent.state === State.ACTIVE) {
								const {
									x,
									y,
									absoluteX,
									absoluteY,
								} = nativeEvent;
								console.log(`long press at ${x}, ${y}, absolute: ${absoluteX}, ${absoluteY}`);
							}
						}}
						minDurationMs={100}
					>
						{/* <DraxView style={styles.blueBox}>
							<Text>Zone</Text>
						</DraxView> */}
						{/* <View style={styles.blueBox} /> */}
						<Box style={styles.blueBox} name="blue" />
						{/* <Box2 style={styles.blueBox} name="blue" /> */}
					</LongPressGestureHandler>
					{/* <Box style={styles.blueBox} name="blue" /> */}
					{/* <View style={{ paddingTop: 0 }}>
						<Box style={styles.blueBox} name="blue" />
					</View> */}
					{/* <ScrollView>
						<Box style={styles.blueBox} name="blue" />
						<Box style={styles.greenBox} name="green" />
						<Box style={styles.redBox} name="red" />
						<Box style={styles.yellowBox} name="yellow" />
						<Box style={styles.cyanBox} name="cyan" />
					</ScrollView> */}
					{/* <DraxList
						data={items.slice(0, count)}
						renderItem={renderItem}
						keyExtractor={(item) => item}
					/> */}
					<Button title="+" onPress={() => setCount(count + 1)} />
					<Button title="-" onPress={() => setCount(count - 1)} />
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
