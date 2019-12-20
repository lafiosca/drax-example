import React, { useState, useRef, RefObject } from 'react';
import {
	SafeAreaView,
	StyleSheet,
	StatusBar,
	Text,
	View,
	ScrollView,
	findNodeHandle,
	FlatList,
	Button,
	Animated,
} from 'react-native';

import {
	DraxProvider,
	DraxView,
	DraxList,
	DraxScrollView,
	DraxViewDragStatus,
} from './drax';

interface Cargo {
	boxName?: string;
	letter?: string;
}

const App = () => {
	const [greenReceived, setGreenReceived] = useState<string[]>([]);
	const [yellowReceived, setYellowReceived] = useState<string[]>([]);
	const blueRef = useRef<View>(null);
	const greenRef = useRef<View>(null);
	const viewRef = useRef<View>(null);
	const scrollRef = useRef<ScrollView>(null);
	const flatRef = useRef<FlatList<string>>(null);
	const [numData, setNumData] = useState([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
	// const [alphaData, setAlphaData] = useState(['A', 'B', 'C']);
	const [alphaData, setAlphaData] = useState(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R']);
	const measureRef = (name: string, ref: RefObject<View>) => {
		ref.current?.measure((x, y, width, height, pageX, pageY) => {
			console.log(`${name} measure: ${JSON.stringify({ x, y, width, height, pageX, pageY }, null, 2)}`);
		});
		ref.current?.measureInWindow((x, y, width, height) => {
			console.log(`${name} measureInWindow: ${JSON.stringify({ x, y, width, height }, null, 2)}`);
		});
		// if (flatRef.current) {
		// 	const handle = findNodeHandle(flatRef.current);
		// 	if (handle) {
		// 		ref.current?.measureLayout(
		// 			handle,
		// 			(x, y, width, height) => {
		// 				console.log(`${name} measureLayout flatRef: ${JSON.stringify({ x, y, width, height }, null, 2)}`);
		// 			},
		// 			() => {
		// 				console.log(`${name} measureLayout flatRef failed`);
		// 			},
		// 		);
		// 	} else {
		// 		console.log(`failed to find handle for flatRef (${name})`);
		// 	}
		// } else {
		// 	console.log(`no flatRef (${name})`);
		// }
		// if (viewRef.current) {
		// 	const handle = findNodeHandle(viewRef.current);
		// 	if (handle) {
		// 		ref.current?.measureLayout(
		// 			handle,
		// 			(x, y, width, height) => {
		// 				console.log(`${name} measureLayout viewRef: ${JSON.stringify({ x, y, width, height }, null, 2)}`);
		// 			},
		// 			() => {
		// 				console.log(`${name} measureLayout viewRef failed`);
		// 			},
		// 		);
		// 	} else {
		// 		console.log(`failed to find handle for viewRef (${name})`);
		// 	}
		// } else {
		// 	console.log(`no viewRef (${name})`);
		// }
		if (scrollRef.current) {
			const handle = findNodeHandle(scrollRef.current);
			if (handle) {
				ref.current?.measureLayout(
					handle,
					(x, y, width, height) => {
						console.log(`${name} measureLayout scrollRef: ${JSON.stringify({ x, y, width, height }, null, 2)}`);
					},
					() => {
						console.log(`${name} measureLayout scrollRef failed`);
					},
				);
			} else {
				console.log(`failed to find handle for scrollRef (${name})`);
			}
		} else {
			console.log(`no scrollRef (${name})`);
		}
	};
	return (
		<>
			<StatusBar barStyle="dark-content" />
			<SafeAreaView style={styles.container}>
				{/* <FlatList
					ref={flatRef}
					onLayout={({ nativeEvent }) => {
						console.log(`flatlist onLayout: ${JSON.stringify(nativeEvent.layout, null, 2)}`);
					}}
					style={{ flex: 1, margin: 30, backgroundColor: 'grey' }}
					data={['y', 'y', 'y', 'y', 'y', 'y', 'y', 'h', 'blue', 'green', 'y', 'y', 'y', 'y']}
					renderItem={({ item }) => {
						if (item === 'blue' || item === 'green') {
							const ref = item === 'green' ? greenRef : blueRef;
							const margin = item === 'green' ? 15 : 0;
							return (
								<View
									ref={ref}
									style={{
										width: 200,
										height: 100,
										backgroundColor: item,
										marginLeft: margin,
										marginTop: margin,
									}}
									collapsable={false}
									onLayout={({ nativeEvent }) => {
										console.log(`${item} onLayout: ${JSON.stringify(nativeEvent.layout, null, 2)}`);
										measureRef(item, ref);
									}}
								/>
							);
						}
						return (
							<View
								style={{
									width: 10,
									height: (item === 'h' ? 40 : 90),
									marginLeft: 10,
									marginBottom: 10,
									backgroundColor: 'yellow',
								}}
							/>
						);
					}}
					keyExtractor={(item, index) => `${index}`}
				/> */}
				{/* <View style={{ marginBottom: 30 }}>
					<Button
						title="measure"
						onPress={() => {
							console.log('**** REMEASURE ***');
							measureRef('blue', blueRef);
							measureRef('green', greenRef);
						}}
					/>
				</View> */}
				{/* <ScrollView
					ref={scrollRef}
					style={{ flex: 1, margin: 30, backgroundColor: 'grey' }}
					onLayout={({ nativeEvent }) => {
						console.log(`scrollview onLayout: ${JSON.stringify(nativeEvent.layout, null, 2)}`);
						console.log(`inner view node: ${scrollRef.current?.getInnerViewNode()}`);
						console.log(`scrollable node: ${scrollRef.current?.getScrollableNode()}`);
						console.log(`scroll responder scrollable node: ${scrollRef.current?.scrollResponderGetScrollableNode()}`);
					}}
				>
					<View style={{ width: 10, height: 90, marginLeft: 10, marginBottom: 10, backgroundColor: 'yellow' }} />
					<View style={{ width: 10, height: 90, marginLeft: 10, marginBottom: 10, backgroundColor: 'yellow' }} />
					<View style={{ width: 10, height: 90, marginLeft: 10, marginBottom: 10, backgroundColor: 'yellow' }} />
					<View style={{ width: 10, height: 90, marginLeft: 10, marginBottom: 10, backgroundColor: 'yellow' }} />
					<View style={{ width: 10, height: 90, marginLeft: 10, marginBottom: 10, backgroundColor: 'yellow' }} />
					<View style={{ width: 10, height: 90, marginLeft: 10, marginBottom: 10, backgroundColor: 'yellow' }} />
					<View style={{ width: 10, height: 90, marginLeft: 10, marginBottom: 10, backgroundColor: 'yellow' }} />
					<View style={{ width: 10, height: 40, marginLeft: 10, marginBottom: 10, backgroundColor: 'yellow' }} />
					<View
						ref={blueRef}
						style={{ width: 200, height: 100, backgroundColor: 'blue' }}
						onLayout={({ nativeEvent }) => {
							console.log(`blueRef onLayout layout: ${JSON.stringify(nativeEvent.layout, null, 2)}`);
							measureRef('blue', blueRef);
						}}
					/>
					<View
						ref={greenRef}
						style={{ width: 200, height: 100, backgroundColor: 'green', marginTop: 15, marginLeft: 15 }}
						onLayout={({ nativeEvent }) => {
							console.log(`greenRef onLayout layout: ${JSON.stringify(nativeEvent.layout, null, 2)}`);
							measureRef('green', blueRef);
						}}
					/>
				</ScrollView>
				<View style={{ marginBottom: 30 }}>
					<Button
						title="measure"
						onPress={() => {
							console.log('**** REMEASURE ***');
							measureRef('blue', blueRef);
							measureRef('green', greenRef);
						}}
					/>
				</View> */}
				{/* <View ref={viewRef} style={{ flex: 1, margin: 30, backgroundColor: 'grey' }}>
					<View
						ref={blueRef}
						style={{ width: 200, height: 100, backgroundColor: 'blue' }}
						onLayout={({ nativeEvent }) => {
							console.log(`blueRef onLayout layout: ${JSON.stringify(nativeEvent.layout, null, 2)}`);
							blueRef.current?.measure((x, y, width, height, pageX, pageY) => {
								console.log(`blueRef measure: ${JSON.stringify({ x, y, width, height, pageX, pageY }, null, 2)}`);
							});
							blueRef.current?.measureInWindow((x, y, width, height) => {
								console.log(`blueRef measureInWindow: ${JSON.stringify({ x, y, width, height }, null, 2)}`);
							});
							if (viewRef.current) {
								const handle = findNodeHandle(viewRef.current);
								if (handle) {
									blueRef.current?.measureLayout(
										handle,
										(x, y, width, height) => {
											console.log(`blue measureLayout: ${JSON.stringify({ x, y, width, height }, null, 2)}`);
										},
										() => {
											console.log('blue measureLayout failed');
										},
									);
								} else {
									console.log('failed to find handle for parent (blue)');
								}
							}
						}}
					/>
					<View
						ref={greenRef}
						style={{ width: 200, height: 100, backgroundColor: 'green', marginTop: 15, marginLeft: 15 }}
						onLayout={({ nativeEvent }) => {
							console.log(`greenRef onLayout layout: ${JSON.stringify(nativeEvent.layout, null, 2)}`);
							greenRef.current?.measure((x, y, width, height, pageX, pageY) => {
								console.log(`greenRef measure: ${JSON.stringify({ x, y, width, height, pageX, pageY }, null, 2)}`);
							});
							greenRef.current?.measureInWindow((x, y, width, height) => {
								console.log(`greenRef measureInWindow: ${JSON.stringify({ x, y, width, height }, null, 2)}`);
							});
							if (viewRef.current) {
								const handle = findNodeHandle(viewRef.current);
								if (handle) {
									greenRef.current?.measureLayout(
										handle,
										(x, y, width, height) => {
											console.log(`green measureLayout: ${JSON.stringify({ x, y, width, height }, null, 2)}`);
										},
										() => {
											console.log('green measureLayout failed');
										},
									);
								} else {
									console.log('failed to find handle for parent (green)');
								}
							}
						}}
					/>
				</View> */}
				<DraxProvider>
					{/* <ScrollView>
						<DraxView
							style={styles.blueBox}
							draggingStyle={styles.dragHighlight}
							dragReleasedStyle={styles.dragReleaseHighlight}
							onDragStart={({ screenPosition: { x, y } }) => { console.log(`start dragging blue at (${x}, ${y})`); }}
							onDrag={({ screenPosition: { x, y } }) => { console.log(`drag blue at (${x}, ${y})`); }}
							onDragEnd={({ screenPosition: { x, y } }) => { console.log(`stop dragging blue at (${x}, ${y})`); }}
							onDragEnter={(data) => { console.log(`drag blue into: ${JSON.stringify(data, null, 2)}`); }}
							onDragOver={(data) => { console.log(`drag blue over: ${JSON.stringify(data, null, 2)}`); }}
							onDragExit={(data) => { console.log(`drag blue out of: ${JSON.stringify(data, null, 2)}`); }}
							onDragDrop={(data) => { console.log(`drop blue into: ${JSON.stringify(data, null, 2)}`); }}
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
							onReceiveDragDrop={(event) => {
								console.log(`green received drop: ${JSON.stringify(event, null, 2)}`);
								setGreenReceived([
									...greenReceived,
									event.dragged.payload.letter ?? event.dragged.payload.boxName ?? '?',
								]);
							}}
							snapbackDelay={500}
							snapbackDuration={1000}
							payload={{ boxName: 'green' }}
						>
							<Text>draggable and receptive</Text>
							<Text style={styles.receivedText}>{`received: ${greenReceived.join('-')}`}</Text>
						</DraxView>
						<DraxView
							style={styles.yellowBox}
							receivingStyle={styles.receiveHighlight}
							onReceiveDragOver={(event) => {
								console.log(`yellow received drag over: ${JSON.stringify(event, null, 2)}`);
							}}
							onReceiveDragDrop={(event) => {
								console.log(`yellow received drop: ${JSON.stringify(event, null, 2)}`);
								setYellowReceived([
									...yellowReceived,
									event.dragged.payload.letter ?? event.dragged.payload.boxName ?? '?',
								]);
							}}
							receiverPayload={{ boxName: 'yellow' }}
						>
							<Text>receptive only</Text>
							<Text style={styles.receivedText}>{`received: ${yellowReceived.join('-')}`}</Text>
						</DraxView>
						<View style={styles.bottomRow}>
							<DraxView longPressDelay={0} dragPayload={{ letter: 'X' }}>
								<View style={styles.bottomBox}>
									<Text style={styles.bottomBoxText}>X</Text>
								</View>
							</DraxView>
							<DraxView longPressDelay={0} dragPayload={{ letter: 'Y' }}>
								<View style={styles.bottomBox}>
									<Text style={styles.bottomBoxText}>Y</Text>
								</View>
							</DraxView>
							<DraxView longPressDelay={0} dragPayload={{ letter: 'Z' }}>
								<View style={styles.bottomBox}>
									<Text style={styles.bottomBoxText}>Z</Text>
								</View>
							</DraxView>
						</View>
					</ScrollView> */}
					{/* <View style={styles.topRow}>
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
					</View> */}
					{/* <View style={{ alignItems: 'center' }}>
						<DraxView dragPayload={{ letter: 'X' }} style={{ borderWidth: 1, borderColor: 'blue' }}>
							<View style={styles.bottomBox}>
								<Text style={styles.bottomBoxText}>X</Text>
							</View>
						</DraxView>
						<DraxView dragPayload={{ letter: 'Y' }} style={{ borderWidth: 1, borderColor: 'blue' }}>
							<View style={styles.bottomBox}>
								<Text style={styles.bottomBoxText}>Y</Text>
							</View>
						</DraxView>
						<DraxView dragPayload={{ letter: 'Z' }} style={{ borderWidth: 1, borderColor: 'blue' }}>
							<View style={styles.bottomBox}>
								<Text style={styles.bottomBoxText}>Z</Text>
							</View>
						</DraxView>
					</View> */}
					<DraxList
						data={numData}
						horizontal
						renderItem={({ item }) => (
							<View
								style={[
									styles.bottomBox,
									{
										width: 40 + (item % 5 === 0 ? 20 : 0),
										backgroundColor: item % 5 === 0 ? '#ffff99' : (item % 2 === 0 ? '#999999' : '#9999ff'),
									},
								]}
							>
								<Text style={styles.bottomBoxText}>{`${item}`}</Text>
							</View>
						)}
						onListItemMoved={({ fromIndex, toIndex }) => {
							const newData = numData.slice();
							newData.splice(toIndex, 0, newData.splice(fromIndex, 1)[0]);
							setNumData(newData);
						}}
						keyExtractor={(item) => `${item}`}
					/>
					{/* <DraxList
						style={{ flex: 1 }}
						data={alphaData}
						renderItem={({ item }) => (
							<View
								style={[
									styles.bottomBox,
									{
										height: 50
											+ ((item.charCodeAt(0) - 65) % 2 === 0 ? 10 : 0)
											+ ((item.charCodeAt(0) - 65) % 3 === 0 ? 20 : 0),
									},
								]}
							>
								<Text style={styles.bottomBoxText}>{item}</Text>
							</View>
						)}
						onListItemMoved={(fromIndex, toIndex) => {
							setTimeout(
								() => {
									const newData = alphaData.slice();
									newData.splice(toIndex, 0, newData.splice(fromIndex, 1)[0]);
									setAlphaData(newData);
								},
								50,
							);
						}}
						keyExtractor={(item) => item}
					/> */}
					{/* <DraxScrollView
						style={{ backgroundColor: '#dddddd', width: '100%', height: 400 }}
						contentContainerStyle={{ width: 800, height: 800 }}
						horizontal
					>
						<DraxView
							style={styles.gridBlue}
							receivingStyle={styles.gridReceive}
							receptive
						/>
						<DraxView
							style={styles.gridGreen}
							receivingStyle={styles.gridReceive}
							draggingStyle={{ opacity: 0 }}
							dragReleasedStyle={{ opacity: 0.2 }}
							hoverStyle={styles.gridMiniHover}
							hoverDragReleasedStyle={styles.gridHoverRelease}
							receptive
							draggable
							renderHoverView={({ viewState, style }) => {
								const offsetStyle = viewState.grabOffset
									? {
										marginLeft: viewState.grabOffset.x - 25,
										marginTop: viewState.grabOffset.y - 25,
									}
									: undefined;
								return (
									<Animated.View style={[style, offsetStyle]}>
										<Text>WOW</Text>
									</Animated.View>
								);
							}}
						>
							<Text>Draggable</Text>
						</DraxView>
						<DraxView
							style={styles.gridBlue}
							receivingStyle={styles.gridReceive}
							receptive
						/>
						<DraxView
							style={styles.gridGreen}
							hoverStyle={styles.gridHover}
							receivingStyle={styles.gridReceive}
							renderView={({ style }) => {
								console.log(JSON.stringify(style, null, 2));
								return (
									<Animated.View style={style}>
										<Text>Test</Text>
									</Animated.View>
								);
							}}
							receptive
							draggable
						/>
						<DraxView
							style={styles.gridBlue}
							receivingStyle={styles.gridReceive}
							receptive
						/>
						<DraxView
							style={styles.gridGreen}
							draggingStyle={styles.gridHover}
							receivingStyle={styles.gridReceive}
							noHover
							receptive
							draggable
						/>
					</DraxScrollView> */}
					<View
						style={{
							backgroundColor: '#aaaaaa',
							width: '100%',
							height: 300,
							flexDirection: 'row',
						}}
					>
						<DraxView
							style={styles.gridBlue}
							receivingStyle={styles.gridReceive}
							receptive
						/>
						<DraxView
							style={{ width: 100, height: 100, margin: 50 }}
							receivingStyle={styles.gridReceive}
							draggingStyle={{ opacity: 0.2 }}
							dragReleasedStyle={{ opacity: 0.5 }}
							hoverDragReleasedStyle={styles.gridHoverRelease}
							receptive
							draggable
							renderContent={({ viewState }) => (
								<View
									style={styles.gridGreen}
								>
									<Text>Draggable</Text>
								</View>
							)}
							renderHoverContent={({ viewState }) => {
								const offsetStyle = viewState.grabOffset
									? {
										marginLeft: viewState.grabOffset.x - 25,
										marginTop: viewState.grabOffset.y - 25,
									}
									: undefined;
								return (
									<View style={[styles.gridMiniHover, offsetStyle]}>
										<Text>WOW</Text>
									</View>
								);
							}}
						>
							<Text>Draggable</Text>
						</DraxView>
						<DraxView
							style={styles.gridGreen}
							receivingStyle={styles.gridReceive}
							receptive
							draggable
						/>
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
	gridBlue: {
		width: 100,
		height: 100,
		margin: 5,
		backgroundColor: '#aaaaff',
	},
	gridGreen: {
		flex: 1,
		// width: 100,
		// height: 100,
		// margin: 50,
		// padding: 10,
		backgroundColor: '#aaffaa',
	},
	gridMiniHover: {
		width: 50,
		height: 50,
		borderColor: 'blue',
		borderWidth: 2,
		backgroundColor: '#aaffaa',
	},
	gridHover: {
		margin: 0,
		borderColor: 'blue',
		borderWidth: 2,
	},
	gridHoverRelease: {
		borderWidth: 0,
	},
	gridReceive: {
		borderColor: 'red',
		borderWidth: 2,
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
	topRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		margin: 30,
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
