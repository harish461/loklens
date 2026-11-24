/**
 * Stacked, swipeable story cards (reference design): the front card is upright; the next two sit behind it,
 * rotated and shifted right so their edges peek out. Drag the front card left or right past a threshold
 * (or flick it) to send it away; the card behind straightens up and takes its place. Loops at the end.
 * Taps still open the article (the deck only claims clearly horizontal drags).
 * Built on PanResponder + Animated, so no extra native dependencies.
 */
import { useMemo, useRef, useState } from 'react'
import { Animated, PanResponder, StyleSheet, Text, View } from 'react-native'

import type { ArticleCard } from '@/lib/api/types'
import { fonts, spacing, useTheme } from '@/theme'

import { DeckCard, openArticle } from './ArticleCards'

interface Props {
  articles: ArticleCard[]
  width: number // deck area width
  height: number // card height
}

const PEEK = 26 // how far the card behind sticks out on the right
const SWIPE_RATIO = 0.28 // fraction of the width that counts as a swipe
const FLICK_VELOCITY = 0.6

export function SwipeDeck({ articles, width, height }: Props) {
  const t = useTheme()
  const [index, setIndex] = useState(0)
  const pan = useRef(new Animated.Value(0)).current
  const animating = useRef(false)
  // A drag ends with a click on web (and sometimes a press on touch); ignore taps right after a drag.
  const lastDragEnd = useRef(0)
  const cardWidth = width - PEEK - spacing.sm
  const count = articles.length

  const responder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_, g) => !animating.current && count > 1 && Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.2,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          lastDragEnd.current = Date.now()
        },
        onPanResponderMove: Animated.event([null, { dx: pan }], { useNativeDriver: false }),
        onPanResponderRelease: (_, g) => {
          lastDragEnd.current = Date.now()
          const swiped = Math.abs(g.dx) > cardWidth * SWIPE_RATIO || Math.abs(g.vx) > FLICK_VELOCITY
          if (!swiped) {
            Animated.spring(pan, { toValue: 0, useNativeDriver: false, friction: 6 }).start()
            return
          }
          animating.current = true
          const direction = g.dx >= 0 ? 1 : -1
          Animated.timing(pan, { toValue: direction * width * 1.4, duration: 220, useNativeDriver: false }).start(() => {
            setIndex((i) => (i + 1) % count)
            pan.setValue(0)
            animating.current = false
          })
        },
        onPanResponderTerminate: () => Animated.spring(pan, { toValue: 0, useNativeDriver: false }).start(),
      }),
    [pan, cardWidth, width, count],
  )

  if (count === 0) return null

  // Drag progress 0 → 1 (either direction) moves the stack forward one step.
  const progress = pan.interpolate({ inputRange: [-cardWidth, 0, cardWidth], outputRange: [1, 0, 1], extrapolate: 'clamp' })
  const frontRotate = pan.interpolate({ inputRange: [-cardWidth, 0, cardWidth], outputRange: ['-10deg', '0deg', '10deg'] })

  /** Pose for the card `depth` places behind the front one, eased toward depth-1 while dragging. */
  const pose = (depth: number) => {
    const at = (d: number) => ({ rotate: d * 5, x: d * (PEEK / 2 + 4), y: d * 6, scale: 1 - d * 0.035 })
    const from = at(depth)
    const to = at(depth - 1)
    return {
      transform: [
        { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [from.x, to.x] }) },
        { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [from.y, to.y] }) },
        { rotate: progress.interpolate({ inputRange: [0, 1], outputRange: [`${from.rotate}deg`, `${to.rotate}deg`] }) },
        { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [from.scale, to.scale] }) },
      ],
    }
  }

  const visible = Math.min(3, count)
  const layers = Array.from({ length: visible }, (_, depth) => ({ depth, article: articles[(index + depth) % count] })).reverse()

  return (
    <View>
      <View style={{ width, height: height + 16 }} {...responder.panHandlers}>
        {layers.map(({ depth, article }) => (
          <Animated.View
            key={`${article.id}-${depth === 0 ? 'front' : depth}`}
            pointerEvents={depth === 0 ? 'auto' : 'none'}
            style={[
              styles.layer,
              { width: cardWidth },
              depth === 0 ? { transform: [{ translateX: pan }, { rotate: frontRotate }] } : pose(depth),
            ]}
          >
            <DeckCard
              article={article}
              width={cardWidth}
              height={height}
              onPress={() => {
                if (Date.now() - lastDragEnd.current > 350) openArticle(article)
              }}
            />
          </Animated.View>
        ))}
      </View>
      {count > 1 && (
        <Text style={[styles.counter, { color: t.subtle }]} accessibilityLiveRegion="polite">
          {index + 1} / {count} · स्वाइप करें
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', top: 0, left: 0 },
  counter: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: spacing.sm },
})
