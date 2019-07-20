using System;
using System.Reflection;
using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;

namespace Unity.Collections.LowLevel.Unsafe
{
    public static partial class UnsafeUtility
    {
        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public static IntPtr GetFieldOffset(FieldInfo field)
        {
            return Marshal.OffsetOf(field.ReflectedType, field.Name);
        }
    }
}
