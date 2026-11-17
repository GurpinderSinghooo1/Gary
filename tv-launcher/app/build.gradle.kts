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
        // CI run number, so every GitHub build is a newer version than the last.
        versionCode = (System.getenv("GITHUB_RUN_NUMBER") ?: "1").toInt()
        versionName = "0.1.${System.getenv("GITHUB_RUN_NUMBER") ?: "0"}"
    }

    // One fixed key for every build (local and GitHub), so a new APK installs over the old one
    // instead of needing an uninstall. Debug-only key for a sideloaded personal app; password "android".
    signingConfigs {
        getByName("debug") {
            storeFile = file("tvhome-debug.keystore")
            storePassword = "android"
            keyAlias = "androiddebugkey"
            keyPassword = "android"
        }
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
