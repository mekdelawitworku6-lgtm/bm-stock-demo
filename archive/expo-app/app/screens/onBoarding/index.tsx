"use client";

import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type React from "react";
import { useRef, useState } from "react";
import {
    Dimensions,
    Image,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { COLORS } from "../../../constants/Colors";

interface OnboardingScreenProps {
  navigation: any;
}

const { width } = Dimensions.get("window");

const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ navigation }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);

  const onboardingData = [
    // {
    //   id: 1,
    //   title: "Welcome to",
    //   subtitle: "Gelagle Stock",
    //   description:
    //     "Your complete inventory management solution for modern businesses",
    //   image: require("../../../assets/images/Logo/gelagle_logo_horizontal.png"), // Adjust path as needed
    //   showLogo: false,
    // },
    {
      id: 2,
      title: "Manage Sales",
      description:
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor",
      image: require("../../../assets/images/onboarding/page_1.png"), // Adjust path as needed
      showLogo: false,
    },
    {
      id: 3,
      title: "Inventory Management",
      description:
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor",
      image: require("../../../assets/images/onboarding/page_2.png"),
      showLogo: false,
    },
    {
      id: 4,
      title: "Data Analysis & Reports",
      description:
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor",
      image: require("../../../assets/images/onboarding/page_3.png"),
      showLogo: false,
    },
  ];

  const handleScroll = (event: any) => {
    const scrollPosition = event.nativeEvent.contentOffset.x;
    const index = Math.round(scrollPosition / width);
    setCurrentIndex(index);
  };

  const markOnboardingAsSeen = async () => {
    try {
      await AsyncStorage.setItem("hasSeenOnboarding", "true");
    } catch (error) {
      console.error("Error saving onboarding status:", error);
    }
  };

  const handleNext = () => {
    if (currentIndex < onboardingData.length - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      scrollViewRef.current?.scrollTo({ x: nextIndex * width, animated: true });
    } else {
      // Mark onboarding as seen and navigate to login
      markOnboardingAsSeen();
      navigation.navigate("Login");
    }
  };

  const handleStart = () => {
    // Mark onboarding as seen and navigate to login
    markOnboardingAsSeen();
    navigation.navigate("Login");
  };

  const renderOnboardingItem = ({
    item,
    index,
  }: {
    item: any;
    index: number;
  }) => (
    <View style={styles.slide}>
      <View style={styles.content}>
        {item.showLogo ? (
          <View style={styles.logoContainer}>
            <View style={styles.logoIcon}>
              <View style={styles.cube}>
                <View style={[styles.cubeFace, styles.cubeTop]} />
                <View style={[styles.cubeFace, styles.cubeLeft]} />
                <View style={[styles.cubeFace, styles.cubeRight]} />
              </View>
            </View>
            <View style={styles.logoText}>
              <Text style={styles.logoTitle}>Gelagle</Text>
              <Text style={styles.logoSubtitle}>Stock</Text>
            </View>
          </View>
        ) : (
          <View style={styles.imageContainer}>
            <Image
              source={
                typeof item.image === "string"
                  ? { uri: item.image }
                  : item.image
              }
              style={styles.image}
              resizeMode="contain"
            />
          </View>
        )}

        <View style={styles.textContainer}>
          {item.showLogo ? (
            <>
              <Text style={styles.welcomeTitle}>{item.title}</Text>
              <Text style={styles.welcomeSubtitle}>{item.subtitle}</Text>
            </>
          ) : (
            <Text style={styles.title}>{item.title}</Text>
          )}
          <Text style={styles.description}>{item.description}</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.startButton} onPress={handleStart}>
          <Text style={styles.startButtonText}>Start</Text>
        </TouchableOpacity>

        <View style={styles.pagination}>
          {onboardingData.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === currentIndex && styles.activeDot]}
            />
          ))}
        </View>

        <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
          <Text style={styles.nextButtonText}>Next</Text>
          <Feather
            name="arrow-right"
            size={16}
            color="#000"
            style={styles.nextIcon}
          />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="white" />

      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {onboardingData.map((item, index) => (
          <View key={item.id} style={styles.slide}>
            {renderOnboardingItem({ item, index })}
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.LIGHTBACKGROUND,
    // paddingLeft: -70,
  },
  slide: {
    width,
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 40,
    paddingRight: 70,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 40,
  },
  logoIcon: {
    marginBottom: 20,
  },
  cube: {
    width: 60,
    height: 60,
    position: "relative",
  },
  cubeFace: {
    position: "absolute",
    width: 60,
    height: 60,
  },
  cubeTop: {
    backgroundColor: "#4A90E2",
    transform: [{ rotateX: "60deg" }, { rotateZ: "45deg" }],
    top: -15,
  },
  cubeLeft: {
    backgroundColor: "#357ABD",
    transform: [{ rotateY: "60deg" }, { rotateZ: "45deg" }],
    left: -15,
  },
  cubeRight: {
    backgroundColor: "#2E5F8F",
    transform: [{ rotateY: "-60deg" }, { rotateZ: "45deg" }],
    right: -15,
  },
  logoText: {
    alignItems: "center",
  },
  logoTitle: {
    fontSize: 32,
    fontWeight: "bold",
    color: "white",
    marginBottom: 4,
  },
  logoSubtitle: {
    fontSize: 32,
    fontWeight: "bold",
    color: "white",
  },
  imageContainer: {
    width: 320,
    height: 280,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 40,
  },
  image: {
    width: 280,
    height: 200,
    borderRadius: 15,
  },
  textContainer: {
    alignItems: "center",
    paddingHorizontal: 20,
  },
  welcomeTitle: {
    fontSize: 24,
    color: COLORS.SUBTEXT,
    textAlign: "center",
    marginBottom: 4,
  },
  welcomeSubtitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "white",
    textAlign: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: COLORS.PRIMARY,
    textAlign: "center",
    marginBottom: 20,
  },
  description: {
    fontSize: 16,
    color: COLORS.SUBTEXT,
    textAlign: "center",
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  startButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  startButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.PRIMARY,
  },
  pagination: {
    flexDirection: "row",
    alignItems: "center",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#949494",
    marginHorizontal: 4,
  },
  activeDot: {
    backgroundColor: COLORS.PRIMARY,
    width: 24,
  },
  nextButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.PRIMARY,
    marginRight: 8,
  },
  nextIcon: {
    color: COLORS.PRIMARY,
  },
});

export default OnboardingScreen;
