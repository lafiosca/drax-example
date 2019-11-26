import React, {
	forwardRef,
	FunctionComponent,
	PropsWithChildren,
	Ref,
	ReactNode,
} from 'react';
import { View, Text, ViewProps } from 'react-native';

interface TitledViewProps extends ViewProps {
	title: string;
}

export const TitledView = forwardRef((
	{ children, title, ...props }: PropsWithChildren<TitledViewProps>,
	ref: Ref<View>,
) => (
	<View {...props} ref={ref}>
		<Text>{title}</Text>
		{children}
	</View>
));

export const HelloView: FunctionComponent<Omit<TitledViewProps, 'title'>> = ({ children, ...props }) => (
	<TitledView title="Hello" {...props}>
		{children}
	</TitledView>
);

/*
 * First we create a simple function component which forwards a View ref:
 */
interface FooProps extends ViewProps {
	fooText: string;
	children?: ReactNode;
}

export const Foo = forwardRef<View, FooProps>(({ fooText, children, ...props }, ref) => (
	<View {...props} ref={ref}>
		<Text>{fooText}</Text>
		{children}
	</View>
));

/*
 * Next we'll try wrapping that component in other components:
 */
interface BarProps extends FooProps {
	barText: string;
}

/*
 * For Bar1, respreading the props to Foo and adding children works without complaint.
 *
 * Foo has type: React.ForwardRefExoticComponent<FooProps & React.RefAttributes<View>>
 * props has type: {
 *   fooText: string;
 *   hitSlop?: Insets | undefined;
 *   onLayout?: ((event: LayoutChangeEvent) => void) | undefined;
 *   pointerEvents?: "box-none" | "none" | "box-only" | "auto" | undefined;
 *   ... 49 more ...;
 *   children?: React.ReactNode;
 * }
 */
export const Bar1: FunctionComponent<BarProps> = ({ barText, ...props }) => (
	<Foo {...props}>
		<Text>{barText}</Text>
	</Foo>
);

/*
 * For Bar2, TypeScript complains:
 *
 * Type '{ children: Element; fooText: string; hitSlop?: Insets | undefined; onLayout?:
 * ((event: LayoutChangeEvent) => void) | undefined; pointerEvents?: "box-none" | ... 3 more ...
 * | undefined; ... 48 more ...; accessibilityIgnoresInvertColors?: boolean | undefined; }'
 * is not assignable to type 'IntrinsicAttributes & FooProps & RefAttributes<View>'.
 *   Property 'children' does not exist on type 'IntrinsicAttributes & FooProps & RefAttributes<View>'. ts(2322)
 */
export const Bar2: FunctionComponent<BarProps> = ({ fooText, barText, ...props }) => (
	<Foo {...props} fooText={`${fooText} plus:`}>
		<Text>{barText}</Text>
	</Foo>
);

/*
 * For Bar3, TypeScript complains:
 *
 * Type '{ children: Element; fooText: string; }' is not assignable to type 'IntrinsicAttributes
 * & FooProps & RefAttributes<View>'.
 *   Property 'children' does not exist on type 'IntrinsicAttributes & FooProps & RefAttributes<View>'. ts(2322)
 */
export const Bar3: FunctionComponent<BarProps> = ({ barText }) => (
	<Foo fooText="constant">
		<Text>{barText}</Text>
	</Foo>
);

/*
 * If we do the same thing as above but explicitly specify the type, adding children to Foo's props...
 */
export const NewFoo = forwardRef<View, PropsWithChildren<FooProps>>(({ fooText, children, ...props }, ref) => (
	<View {...props} ref={ref}>
		<Text>{fooText}</Text>
		{children}
	</View>
));

/* ...this works fine: */
export const NewBar3: FunctionComponent<BarProps> = ({ barText }) => (
	<NewFoo fooText="constant">
		<Text>{barText}</Text>
	</NewFoo>
);

/*
 * But if we allow the same children-augmented props type to be inferred for forwardRef...
 */
export const NewBadFoo = forwardRef(({ fooText, children, ...props }: PropsWithChildren<FooProps>, ref: Ref<View>) => (
	<View {...props} ref={ref}>
		<Text>{fooText}</Text>
		{children}
	</View>
));

/*
 * ...this does not work:
 *
 * const NewBadFoo: React.ForwardRefExoticComponent<FooProps & React.RefAttributes<View>>
 * Type '{ children: Element; fooText: string; }' is not assignable to type
 * 'IntrinsicAttributes & FooProps & RefAttributes<View>'.
 *   Property 'children' does not exist on type 'IntrinsicAttributes & FooProps & RefAttributes<View>'. ts(2322)
 */
export const NewBadBar3: FunctionComponent<BarProps> = ({ barText }) => (
	<NewBadFoo fooText="constant">
		<Text>{barText}</Text>
	</NewBadFoo>
);


/*
 * Summary: why does Bar1 work when Bar2 and Bar3 do not?
 *
 *  - Should Bar2 and Bar3 work?
 *
 *  - If not, and Bar1 should not work, is this just a peculiarity of TypeScript?
 *
 *  - Is it a little odd that the props argument of the component function argument
 *    passed to forwardRef automatically includes `children?` in its typing but the
 *    resulting forwarded ref component's props argument does not?
 *
 *  - Is it odd that in the case of NewerFoo, forwardRef strips the `children?`
 *    from the props that it infers?
 */
