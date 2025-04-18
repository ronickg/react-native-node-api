import React from "react";
import { StyleSheet, Text, View } from "react-native";

// import { multiply } from "react-native-node-api-host";

function App(): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>React Native Node-API Modules</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 20,
  },
});

export default App;
