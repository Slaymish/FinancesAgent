#if canImport(SwiftUI)
import SwiftUI

@available(iOS 16.0, *)
public extension View {
    @ViewBuilder
    func financeAgentGlassCard(cornerRadius: CGFloat = 16, strokeOpacity: Double = 0.35) -> some View {
        let shape = RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)

        #if compiler(>=6.2)
        if #available(iOS 26.0, *) {
            self
                .background(
                    shape
                        .fill(.clear)
                        .glassEffect()
                )
                .overlay(
                    shape
                        .stroke(Color.white.opacity(strokeOpacity), lineWidth: 0.6)
                )
        } else {
            self
                .background(.ultraThinMaterial, in: shape)
                .overlay(
                    shape
                        .stroke(Color.white.opacity(strokeOpacity), lineWidth: 0.6)
                )
        }
        #else
        self
            .background(.ultraThinMaterial, in: shape)
            .overlay(
                shape
                    .stroke(Color.white.opacity(strokeOpacity), lineWidth: 0.6)
            )
        #endif
    }

    @ViewBuilder
    func financeAgentGlassCircle(strokeOpacity: Double = 0.35) -> some View {
        let shape = Circle()

        #if compiler(>=6.2)
        if #available(iOS 26.0, *) {
            self
                .background(
                    shape
                        .fill(.clear)
                        .glassEffect()
                )
                .overlay(
                    shape
                        .stroke(Color.white.opacity(strokeOpacity), lineWidth: 0.6)
                )
        } else {
            self
                .background(.ultraThinMaterial, in: shape)
                .overlay(
                    shape
                        .stroke(Color.white.opacity(strokeOpacity), lineWidth: 0.6)
                )
        }
        #else
        self
            .background(.ultraThinMaterial, in: shape)
            .overlay(
                shape
                    .stroke(Color.white.opacity(strokeOpacity), lineWidth: 0.6)
            )
        #endif
    }
}
#endif
