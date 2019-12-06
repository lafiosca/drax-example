import React, {
	PropsWithChildren,
	ReactElement,
	useState,
	useRef,
	useEffect,
	useCallback,
	Ref,
	useMemo,
} from 'react';
import {
	ListRenderItemInfo,
	ViewToken,
	NativeScrollEvent,
	NativeSyntheticEvent,
} from 'react-native';
import {
	FlatList,
} from 'react-native-gesture-handler';
import uuid from 'uuid/v4';

import { DraxListProps, DraxViewRegistration } from './types';
import { DraxView } from './DraxView';

interface TypedViewToken<T> extends ViewToken {
	item: T;
}

interface ViewableItemsChangeInfo<T> {
	viewableItems: TypedViewToken<T>[];
	changed: TypedViewToken<T>[];
}

interface DraxViewRegistry {
	[key: string]: DraxViewRegistration | undefined;
}

interface WithKey {
	key: string;
}

const hasKey = (item: unknown): item is WithKey => (
	!!item && typeof (item as any).key === 'string'
);

export const DraxList = <T extends unknown>(
	{
		renderItem,
		...props
	}: PropsWithChildren<DraxListProps<T>>,
): ReactElement => {
	const [id, setId] = useState(''); // The unique identifer for this list, initialized below.
	const registryRef = useRef<DraxViewRegistry>({}); // A registry of all item views.

	useEffect(() => { setId(uuid()); }, []); // Initialize id once.

	// Find or construct keyExtractor.
	const keyExtractor = useMemo(
		() => {
			if (props.keyExtractor) {
				return props.keyExtractor;
			}
			return (item: T, index: number) => (hasKey(item) ? item.key : `${index}`);
		},
		[props.keyExtractor],
	);

	// Drax view renderItem wrapper.
	const renderDraxViewItem = useCallback(
		(info: ListRenderItemInfo<T>) => {
			const { item, index } = info;
			const key = keyExtractor(item, index);
			return (
				<DraxView
					payload={{ id, index }}
					registration={(registration) => {
						registryRef.current[key] = registration;
					}}
					onDragDrop={(payload: any) => {
						console.log(`Dragged ${index} onto ${payload.index}`);
					}}
					draggingStyle={{ backgroundColor: 'red' }}
					receivingStyle={{ backgroundColor: 'magenta' }}
				>
					{renderItem(info)}
				</DraxView>
			);
		},
		[id, keyExtractor, renderItem],
	);

	const onViewableItemsChanged = useCallback(
		({ viewableItems, changed }: ViewableItemsChangeInfo<T>) => {
			changed.forEach(({ item, index }) => {
				console.log(`viewability changed for ${index}`);
				const key = keyExtractor(item, index || -1);
				registryRef.current[key]?.measure();
			});
		},
		[keyExtractor],
	);

	const onScroll = useCallback(
		({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
		},
		[],
	);

	return (
		<FlatList
			renderItem={renderDraxViewItem}
			onViewableItemsChanged={onViewableItemsChanged}
			onScroll={onScroll}
			{...props}
		/>
	);
};
