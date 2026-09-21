import React, {useMemo, useState} from 'react';
import {LayoutChangeEvent, Pressable, StyleSheet, Text, View} from 'react-native';

import {formatSpanHm} from '../domain/session';
import {FocusBucket, TrendRange} from '../domain/models';
import {spacing, Theme} from '../theme/theme';

const PLOT_HEIGHT = 170;
const MAX_BAR_WIDTH = 24;
const MIN_BAR_HEIGHT = 3;

/**
 * One series, one baseline. Bars stay thin and the grid stays recessive so the only
 * loud thing on the card is the data. Tapping a column names it, but every value is
 * also reachable from the axis and the summary, so the readout enhances rather than
 * gates.
 */
export function FocusChart({
  theme,
  buckets,
  range,
  selectedIndex,
  onSelect,
}: {
  theme: Theme;
  buckets: FocusBucket[];
  range: TrendRange;
  selectedIndex: number | null;
  onSelect(index: number | null): void;
}) {
  const peak = useMemo(
    () => buckets.reduce((max, bucket) => Math.max(max, bucket.focusMillis), 0),
    [buckets],
  );
  const peakIndex = useMemo(
    () => buckets.findIndex(bucket => bucket.focusMillis === peak && peak > 0),
    [buckets, peak],
  );

  // A dense month cannot carry a label per day without them colliding.
  const labelEvery = range === 'month' ? 5 : 1;
  const barWidth = Math.min(MAX_BAR_WIDTH, range === 'month' ? 8 : 18);
  const [plotWidth, setPlotWidth] = useState(0);
  const onPlotLayout = (event: LayoutChangeEvent) =>
    setPlotWidth(event.nativeEvent.layout.width);

  // Ticks are measured, not guessed: each label gets the room its neighbours are
  // not using, so a day number is never clipped to an ellipsis.
  const pitch = buckets.length ? plotWidth / buckets.length : 0;
  const tickWidth = Math.max(18, Math.floor(pitch * labelEvery) - 2);
  const ticks = buckets
    .map((_, index) => index)
    .filter(index => index % labelEvery === 0 || index === buckets.length - 1);

  return (
    <View>
      <View style={styles.plotArea} onLayout={onPlotLayout}>
        <View style={styles.axisLabels}>
          <Text style={[styles.axisValue, {color: theme.textMuted}]}>
            {peak > 0 ? formatSpanHm(peak) : ''}
          </Text>
        </View>
        <View
          pointerEvents="none"
          style={[styles.gridline, styles.gridlineTop, {backgroundColor: theme.border}]}
        />
        <View
          pointerEvents="none"
          style={[styles.gridline, styles.gridlineBase, {backgroundColor: theme.borderStrong}]}
        />

        <View style={styles.bars}>
          {buckets.map((bucket, index) => {
            const ratio = peak > 0 ? bucket.focusMillis / peak : 0;
            const height = bucket.focusMillis > 0
              ? Math.max(MIN_BAR_HEIGHT, Math.round(ratio * (PLOT_HEIGHT - 18)))
              : MIN_BAR_HEIGHT;
            const selected = selectedIndex === index;
            const empty = bucket.focusMillis === 0;
            return (
              <Pressable
                key={bucket.startTimestamp}
                accessibilityRole="button"
                accessibilityLabel={`${bucket.label}, ${formatSpanHm(bucket.focusMillis)} of focus`}
                accessibilityState={{selected}}
                onPress={() => onSelect(selected ? null : index)}
                style={styles.column}>
                <View
                  style={[
                    styles.bar,
                    {
                      width: barWidth,
                      height,
                      backgroundColor: empty ? theme.border : theme.chartSeries,
                    },
                    // One series, one hue. A selection dims its neighbours instead of
                    // repainting the chosen bar, so the colour never encodes value.
                    selectedIndex !== null && !selected && !empty && styles.dimmed,
                  ]}
                />
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.labels}>
        {plotWidth > 0
          ? ticks.map(index => {
              const bucket = buckets[index];
              const emphasised =
                selectedIndex === index || (selectedIndex === null && index === peakIndex);
              return (
                <Text
                  key={bucket.startTimestamp}
                  numberOfLines={1}
                  style={[
                    styles.label,
                    {
                      color: emphasised ? theme.text : theme.textMuted,
                      width: tickWidth,
                      left: (index + 0.5) * pitch - tickWidth / 2,
                    },
                    emphasised && styles.labelEmphasised,
                  ]}>
                  {bucket.label}
                </Text>
              );
            })
          : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  plotArea: {height: PLOT_HEIGHT, justifyContent: 'flex-end'},
  axisLabels: {position: 'absolute', top: 0, right: 0},
  axisValue: {fontSize: 11, fontWeight: '600', fontVariant: ['tabular-nums']},
  gridline: {position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth},
  gridlineTop: {top: 16},
  gridlineBase: {bottom: 0},
  bars: {flexDirection: 'row', alignItems: 'flex-end', height: PLOT_HEIGHT},
  // The 1px on each side is the 2px surface gap between neighbouring bars.
  column: {flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%', paddingHorizontal: 1},
  bar: {borderTopLeftRadius: 4, borderTopRightRadius: 4},
  dimmed: {opacity: 0.4},
  labels: {height: 16, marginTop: spacing.xs},
  label: {position: 'absolute', fontSize: 10, fontWeight: '600', textAlign: 'center'},
  labelEmphasised: {fontWeight: '800'},
});
