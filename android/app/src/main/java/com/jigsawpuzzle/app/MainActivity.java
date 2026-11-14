package com.jigsawpuzzle.app;

import android.content.pm.ActivityInfo;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    /** Tablets start at 600dp smallest width (Android's own definition). */
    private static final int TABLET_MIN_WIDTH_DP = 600;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Phones: portrait only. Tablets: any orientation.
        boolean tablet = getResources().getConfiguration().smallestScreenWidthDp >= TABLET_MIN_WIDTH_DP;
        setRequestedOrientation(
            tablet ? ActivityInfo.SCREEN_ORIENTATION_FULL_USER : ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
        );
        super.onCreate(savedInstanceState);
    }
}
