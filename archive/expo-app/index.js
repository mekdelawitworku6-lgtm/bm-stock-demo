import { registerRootComponent } from "expo";
import App from "./App"; // Metro bundler will resolve App.tsx

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go, in a development build,
// or in a production build, the environment is set up appropriately.
registerRootComponent(App);
