import React, { useEffect, useState } from "react";
import { StyleSheet, View, SafeAreaView, Text } from "react-native";

import {
  MochaRemoteProvider,
  ConnectionText,
  StatusEmoji,
  StatusText,
} from "mocha-remote-react-native";

import { suites as nodeAddonExamplesSuites } from "@react-native-node-api/node-addon-examples";

export default function App() {
  const [sum, setSum] = useState(0);
    useEffect(() => {
      const exampleAddon = require("ferric-example");
      console.log(exampleAddon);
      setSum(exampleAddon.sum(1, 2));

    }, [])
    useEffect(() => {
      const chiaWalletSdk1 = require("rn-chia-wallet-sdk");

      console.log(chiaWalletSdk1);

    }, [])

  return (
      <SafeAreaView style={styles.container}>
        <Text>{sum}</Text>
      </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  statusContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  statusEmoji: {
    fontSize: 30,
    margin: 30,
    textAlign: "center",
  },
  statusText: {
    fontSize: 20,
    margin: 20,
    textAlign: "center",
  },
  connectionText: {
    textAlign: "center",
  },
});
