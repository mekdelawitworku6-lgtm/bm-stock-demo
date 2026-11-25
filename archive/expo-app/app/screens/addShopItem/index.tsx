"use client";

import { useCreateProductMutation } from "@/lib/Api/productApi";
import { useGetShopsQuery } from "@/lib/Api/shopApi";
import { useGetWarehousesQuery } from "@/lib/Api/warehouseApi";
import { RootState } from "@/lib/store";
import { Feather } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import React, { useCallback, useEffect, useState } from "react";
import {
    Alert,
    FlatList,
    Image,
    Modal,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useSelector } from "react-redux";
import { COLORS } from "../../../constants/Colors";

const BARCODE_TYPES = [
  "aztec",
  "ean13",
  "ean8",
  "qr",
  "pdf417",
  "upc_e",
  "datamatrix",
  "code128",
  "code39",
  "code93",
  "codabar",
  "upc_a",
  "interleaved2of5",
  "itf14",
  "rss14",
  "rssexpanded",
];

interface AddShopItemScreenProps {
  navigation: any;
  route?: {
    params?: {
      preSelectedLocation?: {
        id: string;
        name: string;
        type: 'warehouse' | 'shop';
      };
    };
  };
}

interface FormFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  required?: boolean;
  multiline?: boolean;
  scanButton?: boolean;
  onScanPress?: () => void;
  customScanButton?: React.ReactNode;
}

interface Warehouse {
  id: string;
  name: string;
}

interface Shop {
  id: string;
  name: string;
}

interface LocationItem {
  id: string;
  name: string;
  description: string;
  type: 'warehouse' | 'shop';
}

const FormField: React.FC<FormFieldProps> = React.memo(
  ({
    label,
    value,
    onChangeText,
    placeholder,
    required = false,
    multiline = false,
    scanButton = false,
    onScanPress,
    customScanButton,
  }) => (
    <View style={styles.formField}>
      <View style={styles.labelContainer}>
        <Text style={styles.fieldLabel}>
          {label}
          {required && <Text style={styles.required}>*</Text>}
        </Text>
        {customScanButton ||
          (scanButton && (
            <TouchableOpacity style={styles.scanButton} onPress={onScanPress}>
              <Feather name="camera" size={20} color={COLORS.PRIMARY} />
              <Text style={styles.scanButtonText}>Scan</Text>
            </TouchableOpacity>
          ))}
      </View>
      <TextInput
        style={[styles.textInput, multiline && styles.multilineInput]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#999"
        multiline={multiline}
        numberOfLines={multiline ? 4 : 1}
        autoCapitalize="none"
      />
    </View>
  ),
  (prevProps, nextProps) => {
    return (
      prevProps.value === nextProps.value &&
      prevProps.placeholder === nextProps.placeholder &&
      prevProps.required === nextProps.required &&
      prevProps.multiline === nextProps.multiline &&
      prevProps.scanButton === nextProps.scanButton &&
      prevProps.label === nextProps.label
    );
  }
);

const AddShopItemScreen: React.FC<AddShopItemScreenProps> = ({
  navigation,
  route,
}) => {
  const [productName, setProductName] = useState("");
  const [sku, setSku] = useState("");
  const [barcode, setBarcode] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [brand, setBrand] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [initialStock, setInitialStock] = useState("");
  const [description, setDescription] = useState("");
  const [scanned, setScanned] = useState(false);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [imagePickerVisible, setImagePickerVisible] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<LocationItem | null>(null);
  const [locationModalVisible, setLocationModalVisible] = useState(false);
  const [productType, setProductType] = useState("product");
  const [category, setCategory] = useState("");
  const [unit, setUnit] = useState("");
  const [minStockLevel, setMinStockLevel] = useState("");
  const [status, setStatus] = useState("available");
  const [taxRate, setTaxRate] = useState("");
  const [commissionRate, setCommissionRate] = useState("");
  const [trackStock, setTrackStock] = useState(true);
  const [typeModalVisible, setTypeModalVisible] = useState(false);
  const [unitModalVisible, setUnitModalVisible] = useState(false);

  const [permission, requestPermission] = useCameraPermissions();
  const [createProduct, { isLoading, error }] = useCreateProductMutation();
  const { user } = useSelector((state: RootState) => state.auth);

  const { data: warehousesData, isLoading: warehousesLoading } =
    useGetWarehousesQuery({
      page: 1,
      limit: 100,
      search: "",
    });
  const { data: shopsData, isLoading: shopsLoading } =
    useGetShopsQuery({
      page: 1,
      limit: 100,
      search: "",
    });

  const warehouses: Warehouse[] = warehousesData?.data || [];
  const shops: Shop[] = shopsData?.data.data || [];

  // Combine warehouses and shops into a single list
  const locations: LocationItem[] = [
    ...warehouses.map(warehouse => ({
      id: warehouse.id,
      name: warehouse.name,
      description: warehouse.name,
      type: 'warehouse' as const
    })),
    ...shops.map(shop => ({
      id: shop.id,
      name: shop.name,
      description: shop.name,
      type: 'shop' as const
    }))
  ];

  // Handle pre-selected location from route params
  useEffect(() => {
    if (route?.params?.preSelectedLocation) {
      const preSelected = route.params.preSelectedLocation;
      setSelectedLocation({
        id: preSelected.id,
        name: preSelected.name,
        description: preSelected.name,
        type: preSelected.type
      });
    }
  }, [route?.params?.preSelectedLocation]);

  const handleBarCodeScanned = useCallback(
    ({ type, data }: { type: string; data: string }) => {
      console.log("Barcode scanned:", data);
      setBarcode(data);
      setScanned(true);
      setScannerVisible(false);
    },
    []
  );

  const requestImagePermissions = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission needed",
        "Sorry, we need camera roll permissions to select images."
      );
      return false;
    }
    return true;
  }, []);

  const requestCameraPermissions = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission needed",
        "Sorry, we need camera permissions to take photos."
      );
      return false;
    }
    return true;
  }, []);

  const showImagePickerOptions = useCallback(() => {
    setImagePickerVisible(true);
  }, []);

  const takePhoto = useCallback(async () => {
    const hasPermission = await requestCameraPermissions();
    if (!hasPermission) return;

    setImagePickerVisible(false);
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedImage(result.assets[0].uri);
    }
  }, [requestCameraPermissions]);

  const pickImage = useCallback(async () => {
    const hasPermission = await requestImagePermissions();
    if (!hasPermission) return;

    setImagePickerVisible(false);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedImage(result.assets[0].uri);
    }
  }, [requestImagePermissions]);

  const openScanner = useCallback(async () => {
    if (!permission) {
      return;
    }

    if (!permission.granted) {
      const response = await requestPermission();
      if (!response.granted) {
        return;
      }
    }

    setScanned(false);
    setScannerVisible(true);
  }, [permission, requestPermission]);

  const showDatePickerModal = useCallback(() => {
    setShowDatePicker(true);
  }, []);

  const handleDateChange = useCallback((event: any, date?: Date) => {
    setShowDatePicker(false);
    if (date) {
      setSelectedDate(date);
      setExpiryDate(date.toISOString().split("T")[0]);
    }
  }, []);

  const handleAddProduct = useCallback(async () => {
    if (!productName || !costPrice || !sellingPrice || !selectedLocation || !unit || !category) {
      Alert.alert(
        "Error",
        "Please fill in all required fields, including location, unit, and category"
      );
      return;
    }

    const imageUrl = selectedImage
      ? await uploadImage(selectedImage)
      : "https://example.com/default.jpg";

    // Build payload with only non-empty fields
    const payload: any = {
      companyId: user?.companyId || user?.company?.id,
      type: productType,
      name: productName,
      price: Number.parseFloat(sellingPrice) || 0,
      cost: Number.parseFloat(costPrice) || 0,
      unit: unit, // Unit is required
    };

    // Add location IDs based on selection
    if (selectedLocation) {
      if (selectedLocation.type === 'warehouse') {
        payload.warehouseIds = [selectedLocation.id];
      } else if (selectedLocation.type === 'shop') {
        payload.shopIds = [selectedLocation.id];
      }
    }

    // Add optional fields only if they have values
    if (description?.trim()) payload.description = description.trim();
    if (sku?.trim()) payload.sku = sku.trim();
    if (barcode?.trim()) payload.barcode = barcode.trim();
    if (brand?.trim()) {
      payload.metadata = { brand: brand.trim() };
    }
    if (initialStock?.trim()) {
      const stockQty = Number.parseInt(initialStock, 10);
      if (!isNaN(stockQty) && stockQty > 0) {
        payload.stockQuantity = stockQty;
      }
    }
    if (expiryDate?.trim()) payload.expiryDate = expiryDate.trim();
    if (category?.trim()) payload.category = category.trim();
    if (unit?.trim()) payload.unit = unit.trim();
    if (minStockLevel?.trim()) {
      const minStock = Number.parseInt(minStockLevel, 10);
      if (!isNaN(minStock) && minStock >= 0) {
        payload.minStockLevel = minStock;
      }
    }
    if (status?.trim()) payload.status = status;
    if (taxRate?.trim()) {
      const tax = Number.parseFloat(taxRate);
      if (!isNaN(tax) && tax >= 0) {
        payload.taxRate = tax;
      }
    }
    if (commissionRate?.trim()) {
      const commission = Number.parseFloat(commissionRate);
      if (!isNaN(commission) && commission >= 0) {
        payload.commissionRate = commission;
      }
    }
    payload.trackStock = trackStock;
    
    // Always add imageUrl if available
    if (imageUrl) payload.imageUrl = imageUrl;

    console.log("Sending payload:", payload);

    try {
      await createProduct(payload).unwrap();
      Alert.alert("Success", "Product added successfully");
      navigation.goBack();
    } catch (error: any) {
      console.error("API Error:", error);
      Alert.alert("Error", error?.data?.message || "Failed to add product");
    }
  }, [
    productName,
    costPrice,
    sellingPrice,
    selectedImage,
    description,
    sku,
    barcode,
    initialStock,
    expiryDate,
    brand,
    selectedLocation,
    productType,
    category,
    unit,
    minStockLevel,
    status,
    taxRate,
    commissionRate,
    trackStock,
    createProduct,
    navigation,
  ]);

  const uploadImage = async (uri: string): Promise<string> => {
    console.log("Uploading image:", uri);
    return "https://example.com/uploaded/" + Date.now() + ".jpg";
  };

  const selectLocation = useCallback((location: LocationItem) => {
    setSelectedLocation(location);
    setLocationModalVisible(false);
  }, []);

  const selectProductType = useCallback((type: string) => {
    setProductType(type);
    setTypeModalVisible(false);
  }, []);

  const selectUnit = useCallback((selectedUnit: string) => {
    setUnit(selectedUnit);
    setUnitModalVisible(false);
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="white" />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Feather name="arrow-left" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Product</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.imageSection}>
          <TouchableOpacity
            style={styles.imageUpload}
            onPress={showImagePickerOptions}
          >
            {selectedImage ? (
              <>
                <Image
                  source={{ uri: selectedImage }}
                  style={styles.selectedImage}
                />
                <View style={styles.imageOverlay}>
                  <Feather name="edit-2" size={20} color="white" />
                </View>
              </>
            ) : (
              <View style={styles.imagePlaceholder}>
                <View style={styles.imageIconContainer}>
                  <Feather name="image" size={32} color={COLORS.PRIMARY} />
                </View>
                <Text style={styles.imagePlaceholderText}>
                  Add Product Image
                </Text>
                <Text style={styles.imagePlaceholderSubtext}>
                  Tap to select or take photo
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.formContainer}>
          <View style={styles.formField}>
            <Text style={styles.fieldLabel}>
              Location
              <Text style={styles.required}>*</Text>
            </Text>
            <TouchableOpacity
              style={[styles.dropdownButton, isLoading && styles.disabledInput]}
              onPress={() => setLocationModalVisible(true)}
              disabled={isLoading}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text
                style={[
                  styles.dropdownText,
                  !selectedLocation && styles.placeholderText,
                ]}
              >
                {selectedLocation ? `${selectedLocation.name} (${selectedLocation.type})` : "Select warehouse or shop"}
              </Text>
              <Feather
                name="chevron-down"
                size={20}
                color="#666"
                style={styles.chevronIcon}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.rowFields}>
            <View style={styles.halfField}>
              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>
                  Type
                  <Text style={styles.required}>*</Text>
                </Text>
                <TouchableOpacity
                  style={[styles.dropdownButton, isLoading && styles.disabledInput]}
                  onPress={() => setTypeModalVisible(true)}
                  disabled={isLoading}
                  activeOpacity={0.7}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text
                    style={[
                      styles.dropdownText,
                      !productType && styles.placeholderText,
                    ]}
                  >
                    {productType || "Select type"}
                  </Text>
                  <Feather
                    name="chevron-down"
                    size={20}
                    color="#666"
                    style={styles.chevronIcon}
                  />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.halfField}>
              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>
                  Unit
                  <Text style={styles.required}>*</Text>
                </Text>
                <TouchableOpacity
                  style={[styles.dropdownButton, isLoading && styles.disabledInput]}
                  onPress={() => setUnitModalVisible(true)}
                  disabled={isLoading}
                  activeOpacity={0.7}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text
                    style={[
                      styles.dropdownText,
                      !unit && styles.placeholderText,
                    ]}
                  >
                    {unit || "Select unit"}
                  </Text>
                  <Feather
                    name="chevron-down"
                    size={20}
                    color="#666"
                    style={styles.chevronIcon}
                  />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <FormField
            label="Product Name"
            value={productName}
            onChangeText={setProductName}
            placeholder="Enter product name"
            required={true}
          />

          <View style={styles.formField}>
            <View style={styles.labelContainer}>
              <Text style={styles.fieldLabel}>Barcode</Text>
            </View>
            <View style={styles.barcodeInputContainer}>
              <TextInput
                style={[styles.textInput, styles.barcodeInput]}
                value={barcode}
                placeholder="Scan barcode to populate"
                placeholderTextColor="#999"
                editable={false}
              />
              <TouchableOpacity
                style={styles.barcodeIconButton}
                onPress={openScanner}
              >
                <Feather name="maximize" size={20} color={COLORS.PRIMARY} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.rowFields}>
            <View style={styles.halfField}>
              <FormField
                label="SKU"
                value={sku}
                onChangeText={setSku}
                placeholder="Enter SKU"
              />
            </View>
            <View style={styles.halfField}>
              <View style={styles.formField}>
                <View style={styles.labelContainer}>
                  <Text style={styles.fieldLabel}>Expiry Date</Text>
                  <TouchableOpacity
                    style={styles.calendarButton}
                    onPress={showDatePickerModal}
                  >
                    <Feather name="calendar" size={16} color={COLORS.PRIMARY} />
                    <Text style={styles.calendarButtonText}>Select</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={styles.textInput}
                  onPress={showDatePickerModal}
                >
                  <Text
                    style={[
                      styles.dateText,
                      !selectedDate && styles.placeholderText,
                    ]}
                  >
                    {expiryDate || "Select date"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={styles.rowFields}>
            <View style={styles.halfField}>
              <FormField
                label="Cost Price"
                value={costPrice}
                onChangeText={setCostPrice}
                placeholder="0.00"
                required={true}
              />
            </View>
            <View style={styles.halfField}>
              <FormField
                label="Selling Price"
                value={sellingPrice}
                onChangeText={setSellingPrice}
                placeholder="0.00"
                required={true}
              />
            </View>
          </View>

          <FormField
            label="Brand"
            value={brand}
            onChangeText={setBrand}
            placeholder="Enter brand"
          />

          <FormField
            label="Category"
            value={category}
            onChangeText={setCategory}
            placeholder="Enter category"
            required={true}
          />

          <View style={styles.rowFields}>
            <View style={styles.halfField}>
              <FormField
                label="Min Stock Level"
                value={minStockLevel}
                onChangeText={setMinStockLevel}
                placeholder="Enter minimum stock"
              />
            </View>
            <View style={styles.halfField}>
              <FormField
                label="Tax Rate (%)"
                value={taxRate}
                onChangeText={setTaxRate}
                placeholder="0.00"
              />
            </View>
          </View>

          <View style={styles.rowFields}>
            <View style={styles.halfField}>
              <FormField
                label="Commission Rate (%)"
                value={commissionRate}
                onChangeText={setCommissionRate}
                placeholder="0.00"
              />
            </View>
            <View style={styles.halfField}>
              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>Status</Text>
                <TouchableOpacity
                  style={styles.statusButton}
                  onPress={() => setStatus(status === "available" ? "unavailable" : "available")}
                >
                  <Text style={styles.statusButtonText}>
                    {status === "available" ? "Available" : "Unavailable"}
                  </Text>
                  <Feather 
                    name={status === "available" ? "check-circle" : "x-circle"} 
                    size={16} 
                    color={status === "available" ? "#10B981" : "#EF4444"} 
                  />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={styles.formField}>
            <View style={styles.labelContainer}>
              <Text style={styles.fieldLabel}>Track Stock</Text>
              <TouchableOpacity
                style={styles.toggleButton}
                onPress={() => setTrackStock(!trackStock)}
              >
                <View style={[styles.toggle, trackStock && styles.toggleActive]}>
                  <View style={[styles.toggleThumb, trackStock && styles.toggleThumbActive]} />
                </View>
                <Text style={styles.toggleText}>
                  {trackStock ? "Yes" : "No"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>


          <FormField
            label="Initial Stock"
            value={initialStock}
            onChangeText={setInitialStock}
            placeholder="Enter quantity"
          />

          <FormField
            label="Description"
            value={description}
            onChangeText={setDescription}
            placeholder="Enter description"
            multiline={true}
          />
        </View>
      </ScrollView>

      <View style={styles.addButtonContainer}>
        <TouchableOpacity
          style={[styles.addButton, isLoading && styles.disabledButton]}
          onPress={handleAddProduct}
          disabled={isLoading}
        >
          {isLoading ? (
            <Feather name="loader" size={20} color="white" />
          ) : (
            <Text style={styles.addButtonText}>Add Product</Text>
          )}
        </TouchableOpacity>
      </View>

      <Modal
        animationType="slide"
        transparent={true}
        visible={locationModalVisible}
        onRequestClose={() => setLocationModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Location</Text>
              <TouchableOpacity onPress={() => setLocationModalVisible(false)}>
                <Feather name="x" size={20} color="#000" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={locations}
              keyExtractor={(item) => item.id}
              renderItem={({ item: location }) => (
                <TouchableOpacity
                  style={styles.warehouseItem}
                  onPress={() => selectLocation(location)}
                  activeOpacity={0.7}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <View style={styles.locationItemContainer}>
                    <Text style={styles.warehouseName}>{location.name}</Text>
                    <View style={styles.locationTag}>
                      <Text style={styles.locationTagText}>{location.type}</Text>
                    </View>
                  </View>
                  <Text style={styles.locationDescription}>
                    <Feather 
                      name={location.type === 'warehouse' ? "map-pin" : "shopping-bag"} 
                      size={14} 
                      color="#6b7280" 
                    />{" "}
                    {location.description}
                  </Text>
                  {selectedLocation?.id === location.id && (
                    <Feather name="check" size={16} color={COLORS.PRIMARY} />
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                (warehousesLoading || shopsLoading) ? (
                  <Text style={styles.loadingText}>Loading locations...</Text>
                ) : (
                  <Text style={styles.noDataText}>No locations available</Text>
                )
              }
            />
          </View>
        </View>
      </Modal>

      {/* Product Type Selection Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={typeModalVisible}
        onRequestClose={() => setTypeModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Product Type</Text>
              <TouchableOpacity onPress={() => setTypeModalVisible(false)}>
                <Feather name="x" size={20} color="#000" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={["product", "service"]}
              keyExtractor={(item) => item}
              renderItem={({ item: type }) => (
                <TouchableOpacity
                  style={styles.warehouseItem}
                  onPress={() => selectProductType(type)}
                  activeOpacity={0.7}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.warehouseName}>{type.charAt(0).toUpperCase() + type.slice(1)}</Text>
                  {productType === type && (
                    <Feather name="check" size={16} color={COLORS.PRIMARY} />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Unit Selection Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={unitModalVisible}
        onRequestClose={() => setUnitModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Unit</Text>
              <TouchableOpacity onPress={() => setUnitModalVisible(false)}>
                <Feather name="x" size={20} color="#000" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={["piece", "kg", "liter", "gram", "meter", "box", "pack", "set", "pair", "dozen", "hour", "day", "month", "year"]}
              keyExtractor={(item) => item}
              renderItem={({ item: unitOption }) => (
                <TouchableOpacity
                  style={styles.warehouseItem}
                  onPress={() => selectUnit(unitOption)}
                  activeOpacity={0.7}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.warehouseName}>{unitOption.charAt(0).toUpperCase() + unitOption.slice(1)}</Text>
                  {unit === unitOption && (
                    <Feather name="check" size={16} color={COLORS.PRIMARY} />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        transparent={false}
        visible={scannerVisible}
        onRequestClose={() => setScannerVisible(false)}
      >
        <View style={styles.scannerContainer}>
          {!permission ? (
            <Text style={styles.scannerText}>
              Requesting camera permission...
            </Text>
          ) : !permission.granted ? (
            <View style={styles.permissionContainer}>
              <Text style={styles.scannerText}>
                Camera permission is required to scan barcodes
              </Text>
              <TouchableOpacity
                style={styles.permissionButton}
                onPress={requestPermission}
              >
                <Text style={styles.permissionButtonText}>
                  Grant Permission
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <CameraView
              style={StyleSheet.absoluteFillObject}
              facing="back"
              onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
              barcodeScannerSettings={{
                barcodeTypes: BARCODE_TYPES,
              }}
            />
          )}

          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setScannerVisible(false)}
          >
            <Feather name="x" size={24} color="white" />
          </TouchableOpacity>

          {permission?.granted && (
            <View style={styles.scannerOverlay}>
              <Text style={styles.scannerInstructions}>
                Point your camera at a barcode to scan
              </Text>
            </View>
          )}
        </View>
      </Modal>

      {showDatePicker && (
        <DateTimePicker
          value={selectedDate || new Date()}
          mode="date"
          display="default"
          onChange={handleDateChange}
          minimumDate={new Date()}
        />
      )}

      <Modal
        animationType="fade"
        transparent={true}
        visible={imagePickerVisible}
        onRequestClose={() => setImagePickerVisible(false)}
      >
        <View style={styles.imagePickerOverlay}>
          <View style={styles.imagePickerModal}>
            <Text style={styles.imagePickerTitle}>Select Image</Text>

            <View style={styles.imagePickerButtons}>
              <TouchableOpacity
                style={styles.imagePickerButton}
                onPress={takePhoto}
              >
                <Feather name="camera" size={24} color={COLORS.PRIMARY} />
                <Text style={styles.imagePickerButtonText}>Camera</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.imagePickerButton}
                onPress={pickImage}
              >
                <Feather name="image" size={24} color={COLORS.PRIMARY} />
                <Text style={styles.imagePickerButtonText}>Gallery</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setImagePickerVisible(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  header: {
    backgroundColor: "white",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 40,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
    flex: 1,
    textAlign: "center",
    marginRight: 32,
  },
  headerRight: {
    width: 32,
  },
  scrollView: {
    flex: 1,
  },
  imageSection: {
    alignItems: "center",
    paddingVertical: 32,
    backgroundColor: "white",
    marginBottom: 16,
  },
  imageUpload: {
    width: 220,
    height: 160,
    borderRadius: 16,
    backgroundColor: "#F8F9FA",
    borderWidth: 2,
    borderColor: "#E8E8E8",
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    overflow: "hidden",
    zIndex: 1,
  },
  imagePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  imageIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: `${COLORS.PRIMARY}15`,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  imagePlaceholderText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  imagePlaceholderSubtext: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
  },
  selectedImage: {
    width: "100%",
    height: "100%",
    borderRadius: 14,
  },
  imageOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 14,
  },
  formContainer: {
    backgroundColor: "white",
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  formField: {
    marginBottom: 20,
  },
  labelContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#000",
  },
  required: {
    color: "#FF4444",
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: "#000",
    backgroundColor: "#F8F9FA",
  },
  multilineInput: {
    height: 100,
    textAlignVertical: "top",
  },
  rowFields: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  halfField: {
    flex: 1,
    marginRight: 8,
  },
  scanButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  scanButtonText: {
    color: COLORS.PRIMARY,
    fontSize: 14,
    marginLeft: 4,
  },
  addButtonContainer: {
    padding: 16,
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
  },
  addButton: {
    backgroundColor: COLORS.PRIMARY,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
  },
  scannerContainer: {
    flex: 1,
    backgroundColor: "#000",
  },
  scannerText: {
    color: "white",
    fontSize: 18,
    textAlign: "center",
  },
  permissionContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  permissionButton: {
    backgroundColor: COLORS.PRIMARY,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  permissionButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  closeButton: {
    position: "absolute",
    top: 40,
    right: 20,
    padding: 10,
    zIndex: 1,
  },
  scannerOverlay: {
    position: "absolute",
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  scannerInstructions: {
    color: "white",
    fontSize: 16,
    textAlign: "center",
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  calendarButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  calendarButtonText: {
    color: COLORS.PRIMARY,
    fontSize: 14,
    marginLeft: 4,
  },
  dateText: {
    fontSize: 16,
    color: "#000",
  },
  placeholderText: {
    color: "#999",
  },
  imagePickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  imagePickerModal: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 300,
    alignItems: "center",
  },
  imagePickerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
    marginBottom: 20,
  },
  imagePickerButtons: {
    flexDirection: "row",
    gap: 20,
    marginBottom: 20,
  },
  imagePickerButton: {
    alignItems: "center",
    padding: 16,
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    minWidth: 80,
  },
  imagePickerButtonText: {
    fontSize: 14,
    color: "#333",
    marginTop: 8,
    fontWeight: "500",
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  cancelButtonText: {
    fontSize: 16,
    color: "#666",
    fontWeight: "500",
  },
  barcodeInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
  },
  barcodeInput: {
    flex: 1,
    backgroundColor: "#F5F5F5",
    color: "#666",
  },
  barcodeIconButton: {
    position: "absolute",
    right: 12,
    padding: 4,
  },
  disabledButton: {
    backgroundColor: "#A0A0A0",
  },
  disabledInput: {
    backgroundColor: "#F0F0F0",
    borderColor: "#A0A0A0",
  },
  dropdownButton: {
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#F8F9FA",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 1,
  },
  dropdownText: {
    fontSize: 16,
    color: "#000",
    flex: 1,
  },
  chevronIcon: {
    transform: [{ rotate: "0deg" }],
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    width: "80%",
    maxHeight: "80%",
    elevation: 5,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
  },
  warehouseItem: {
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  warehouseName: {
    fontSize: 16,
    fontWeight: "500",
    color: "#000",
  },
  loadingText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    paddingVertical: 16,
  },
  noDataText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    paddingVertical: 16,
  },
  statusButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#F8F9FA",
  },
  statusButtonText: {
    fontSize: 16,
    color: "#000",
    flex: 1,
  },
  toggleButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  toggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#E0E0E0",
    justifyContent: "center",
    padding: 2,
  },
  toggleActive: {
    backgroundColor: COLORS.PRIMARY,
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "white",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleThumbActive: {
    transform: [{ translateX: 22 }],
  },
  toggleText: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  locationItemContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  locationTag: {
    backgroundColor: "#e5e7eb",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  locationTagText: {
    fontSize: 12,
    color: "#6b7280",
    fontWeight: "500",
    textTransform: "capitalize",
  },
  locationDescription: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 2,
  },
});

export default AddShopItemScreen;
