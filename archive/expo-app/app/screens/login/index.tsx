"use client"

import { useLoginMutation } from "@/lib/Api/authApi"; // Adjust path based on your project structure
import type React from "react";
import { useState } from "react";
import { Image, Keyboard, ScrollView, StatusBar, StyleSheet, Text, TouchableWithoutFeedback, View } from "react-native";
import { useDispatch } from "react-redux";
import Button from "../../../components/Button";
import FormInput from "../../../components/FormInput";
import { useApiError } from "../../../hooks/useApiError";
import { setNeedsPinSetup } from "../../../lib/authSlice";
import { commonRules } from "../../../utils/validation";

interface LoginScreenProps {
  navigation: any
}

const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
  const [email, setEmail] = useState<string>("")
  const [password, setPassword] = useState<string>("")
  const [showPassword, setShowPassword] = useState<boolean>(false)
  const [emailError, setEmailError] = useState<string | undefined>(undefined)
  const [passwordError, setPasswordError] = useState<string | undefined>(undefined)
  const [login, { isLoading }] = useLoginMutation()
  const dispatch = useDispatch()
  const { handleError, handleSuccess } = useApiError()

  const handleEmailValidation = (error: string | null) => {
    setEmailError(error || undefined)
  }

  const handlePasswordValidation = (error: string | null) => {
    setPasswordError(error || undefined)
  }

  const handleLogin = async () => {
    // Validate form
    if (emailError || passwordError || !email || !password) {
      return
    }

    try {
      const response = await login({ email, password }).unwrap()

      // Check if PIN is already set up
      const securityService = (await import("../../../lib/securityService")).default
      const securityServiceInstance = securityService.getInstance()
      const settings = await securityServiceInstance.getSecuritySettings()

      // Update session time for successful login
      await securityServiceInstance.updateLastUnlockTime()

      if (settings.pinEnabled) {
        // PIN is already set up, go to main app
        handleSuccess("Login successful!")
        navigation.navigate("Main")
      } else {
        // PIN not set up, redirect to PIN setup
        dispatch(setNeedsPinSetup(true))
        handleSuccess("Login successful! Please set up your PIN.")
        navigation.navigate("PinSetup")
      }
    } catch (error: any) {
      handleError(error)
    }
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <StatusBar barStyle="dark-content" backgroundColor="white" />

        {/* Logo Section */}
        <View style={styles.logoContainer}>
          <Image source={require("../../../assets/images/Logo/gelagle_logo.png")} style={styles.logoIcon} />
        </View>

        <Text style={styles.slogan}>All in one inventory management</Text>

        {/* Form Section */}
        <View style={styles.formContainer}>
          {/* Input Fields */}
          <FormInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="Enter your email"
            rules={commonRules.email}
            onValidation={handleEmailValidation}
            error={emailError}
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!isLoading}
          />

          <FormInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="Enter your password"
            rules={commonRules.password}
            onValidation={handlePasswordValidation}
            error={passwordError}
            secureTextEntry={!showPassword}
            rightIcon={showPassword ? "eye-off" : "eye"}
            onRightIconPress={() => setShowPassword(!showPassword)}
            editable={!isLoading}
          />

          {/* Login Button */}
          <Button
            title="Log In"
            onPress={handleLogin}
            loading={isLoading}
            disabled={isLoading || !!emailError || !!passwordError}
            fullWidth
            style={styles.loginButton}
          />
        </View>
      </ScrollView>
    </TouchableWithoutFeedback>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 0,
  },
  logoContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  formContainer: {
    width: "100%",
    paddingHorizontal: 32,
  },
  logoIcon: {
    width: 210,
    height: 70,
    resizeMode: "contain",
  },
  slogan: {
    fontSize: 14,
    color: "#666",
    marginBottom: 42,
    textAlign: "center",
  },
  loginButton: {
    marginTop: 8,
    marginBottom: 24,
  },
  hugLabel: {
    backgroundColor: "#8E24AA",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  hugText: {
    color: "white",
    fontSize: 12,
    fontWeight: "500",
  },
})

export default LoginScreen
