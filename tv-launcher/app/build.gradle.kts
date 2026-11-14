plugins {
    alias(libs.plugins.android.app)
}

kotlin {
    jvmToolchain(libs.versions.java.jdk.get().toInt())
}

android {
    namespace = "com.gary.tvhome"
    compileSdk = libs.versions.android.compileSdk.get().toInt()

    defaultConfig {
        applicationId = "com.gary.tvhome"
        minSdk = libs.versions.android.minSdk.get().toInt()
        targetSdk = libs.versions.android.targetSdk.get().toInt()
        versionCode = 1
        versionName = "0.1.0"
    }

    buildFeatures {
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_21
        targetCompatibility = JavaVersion.VERSION_21
    }
}

dependencies {
    implementation(libs.androidx.core)
    implementation(libs.androidx.webkit)
    implementation(libs.androidx.tvprovider)
    implementation(libs.kotlinx.coroutines.android)
}
